import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const ORIGINALS_BUCKET = "submission-originals";
const PUBLISHED_BUCKET = "published-images";
const CERTIFICATES_BUCKET = "certificates";
const DISPLAY_NAME = "STAGING TEST — PUBLIC SUBMISSION";
const REQUEST_TIMEOUT_MS = 20_000;

async function fetchWithTimeout(input, init = {}) {
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
  return fetch(input, { ...init, signal });
}

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

if (process.env.SUPABASE_TARGET_ENVIRONMENT !== "staging") {
  throw new Error(
    "Refusing to run unless SUPABASE_TARGET_ENVIRONMENT=staging is set explicitly.",
  );
}
if (process.env.EMAIL_SENDING_ENABLED === "true") {
  throw new Error("Gate A requires email sending to remain disabled.");
}

const siteUrl = new URL(requireEnvironment("NEXT_PUBLIC_SITE_URL"));
const supabaseUrl = new URL(requireEnvironment("NEXT_PUBLIC_SUPABASE_URL"));
const publishableKey = requireEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const secretKey = requireEnvironment("SUPABASE_SECRET_KEY");

if (!supabaseUrl.hostname.endsWith(".supabase.co")) {
  throw new Error("The staging smoke test requires a hosted Supabase project URL.");
}
if (!["localhost", "127.0.0.1", "vriksha-vvandhan.vercel.app"].includes(siteUrl.hostname)) {
  throw new Error("The staging smoke test requires the local or canonical Vercel application origin.");
}

const linkedProjectPath = "supabase/.temp/project-ref";
if (!existsSync(linkedProjectPath)) {
  throw new Error("The repository is not linked to the hosted staging project.");
}
const linkedProjectRef = readFileSync(linkedProjectPath, "utf8").trim();
const environmentProjectRef = supabaseUrl.hostname.split(".")[0];
if (!linkedProjectRef || linkedProjectRef !== environmentProjectRef) {
  throw new Error("The linked Supabase project does not match the staging environment.");
}

const service = createClient(supabaseUrl.toString(), secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fetchWithTimeout },
});
const publicClient = createClient(supabaseUrl.toString(), publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fetchWithTimeout },
});

const requestToken = randomBytes(32).toString("hex");
const tokenHash = createHash("sha256").update(requestToken).digest("hex");
const testEmail = `section3-smoke-${Date.now()}@example.invalid`;
const image = await sharp({
  create: {
    width: 640,
    height: 800,
    channels: 3,
    background: { r: 42, g: 85, b: 65 },
  },
})
  .composite([
    {
      input: Buffer.from(
        '<svg width="640" height="800"><circle cx="320" cy="310" r="150" fill="#f1d28b"/><rect x="292" y="390" width="56" height="270" rx="28" fill="#8a4f2d"/></svg>',
      ),
    },
  ])
  .jpeg({ quality: 82 })
  .toBuffer();

let submissionId = null;
let originalPath = null;
let reviewThumbnailPath = null;
let publishedCardPath = null;
let publishedFullPath = null;
let certificatePath = null;
let originalOpenState = null;
let baselineSummary = null;
let baselineMovement = null;
let cleanupComplete = false;

async function post(path, body) {
  const startedAt = performance.now();
  const response = await fetchWithTimeout(new URL(path, siteUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: siteUrl.origin,
    },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${path} failed with HTTP ${response.status}.`);
  }
  console.log(JSON.stringify({ stage: path, durationMs: Math.round(performance.now() - startedAt), status: response.status }));
  return result;
}

async function campaignSummary() {
  const { data, error } = await publicClient.rpc("get_public_campaign_summary");
  const row = data?.[0];
  if (error || !row) throw new Error("Could not read the staging campaign summary.");
  return {
    currentCount: Number(row.current_count),
    targetCount: Number(row.target_count),
    submissionsOpen: row.submissions_open,
  };
}

async function movementSnapshot() {
  const { data, error } = await publicClient.rpc("list_public_movement_entries", {
    p_limit: 100,
    p_before_published_at: null,
    p_before_guardian_number: null,
  });
  if (error) throw new Error("Could not read the public Movement Wall.");
  return JSON.stringify(data ?? []);
}

async function objectExists(bucket, path) {
  const slash = path.lastIndexOf("/");
  const folder = slash >= 0 ? path.slice(0, slash) : "";
  const objectName = slash >= 0 ? path.slice(slash + 1) : path;
  const { data, error } = await service.storage
    .from(bucket)
    .list(folder, { search: objectName, limit: 2 });
  if (error) throw new Error(`Could not inspect ${bucket} cleanup state.`);
  return data.some((object) => object.name === objectName);
}

async function removeIfPresent(bucket, path) {
  if (!path) return;
  const { error } = await service.storage.from(bucket).remove([path]);
  if (error) throw new Error(`${bucket} cleanup failed.`);
  if (await objectExists(bucket, path)) {
    throw new Error(`${bucket} object remains after cleanup.`);
  }
}

try {
  baselineSummary = await campaignSummary();
  baselineMovement = await movementSnapshot();
  originalOpenState = baselineSummary.submissionsOpen;

  if (!originalOpenState) {
    const { error } = await service
      .from("campaign_settings")
      .update({ submissions_open: true })
      .eq("id", 1);
    if (error) throw new Error("Could not temporarily open staging submissions.");
  }

  const reservation = await post("/api/submissions/prepare", {
    displayName: DISPLAY_NAME,
    email: testEmail,
    publicationConsent: true,
    termsAccepted: true,
    requestToken,
    preparedExtension: "jpg",
  });
  assert(
    typeof reservation?.submissionId === "string" &&
      reservation.status === "draft" &&
      reservation.uploadRequired === true &&
      reservation.upload?.bucket === ORIGINALS_BUCKET,
    "Prepare returned an unsafe or incomplete upload descriptor.",
  );
  submissionId = reservation.submissionId;
  originalPath = reservation.upload.path;

  const { data: markedTest, error: markTestError } = await service
    .from("submissions")
    .update({ is_test: true, counts_toward_goal: false })
    .eq("id", submissionId)
    .eq("public_request_token_hash", tokenHash)
    .select("id")
    .maybeSingle();
  if (markTestError || markedTest?.id !== submissionId) {
    throw new Error("Could not mark the staging record as non-counting test data.");
  }

  const file = new File([image], "synthetic-submission.jpg", {
    type: "image/jpeg",
  });
  const { error: uploadError } = await publicClient.storage
    .from(ORIGINALS_BUCKET)
    .uploadToSignedUrl(originalPath, reservation.upload.token, file, {
      contentType: "image/jpeg",
      cacheControl: "3600",
    });
  if (uploadError) throw new Error("The signed staging upload failed.");
  console.log(JSON.stringify({ stage: "signed-upload", status: "passed" }));

  const finalized = await post("/api/submissions/finalize", {
    submissionId,
    requestToken,
  });
  assert(
    finalized?.success === true && finalized.status === "pending_review",
    "Finalise did not return Pending Review.",
  );

  const retriedFinalize = await post("/api/submissions/finalize", {
    submissionId,
    requestToken,
  });
  assert(
    retriedFinalize?.success === true && retriedFinalize.status === "pending_review",
    "The idempotent finalise retry did not remain Pending Review.",
  );

  const retriedPrepare = await post("/api/submissions/prepare", {
    displayName: DISPLAY_NAME,
    email: testEmail,
    publicationConsent: true,
    termsAccepted: true,
    requestToken,
    preparedExtension: "jpg",
  });
  assert(
    retriedPrepare?.submissionId === submissionId &&
      retriedPrepare.status === "pending_review" &&
      retriedPrepare.uploadRequired === false,
    "The idempotent prepare retry did not reuse the Pending Review submission.",
  );

  const [submissionResult, contactsResult, consentsResult, mediaResult, deliveriesResult, certificatesResult] =
    await Promise.all([
      service
        .from("submissions")
        .select(
          "id,status,display_name,is_test,counts_toward_goal,submitted_at,guardian_number,approved_at,published_at,rejected_at",
        )
        .eq("id", submissionId)
        .single(),
      service
        .from("submission_contacts")
        .select("submission_id,email")
        .eq("submission_id", submissionId),
      service
        .from("submission_consents")
        .select("submission_id,publication_consent,terms_accepted")
        .eq("submission_id", submissionId),
      service
        .from("submission_media")
        .select(
          "submission_id,status,original_bucket,original_path,original_mime_type,original_bytes,original_width,original_height,original_checksum_sha256,uploaded_at,review_thumbnail_path,review_thumbnail_width,review_thumbnail_height,review_thumbnail_bytes,review_thumbnail_generated_at,published_bucket,published_card_path,published_full_path,published_at",
        )
        .eq("submission_id", submissionId),
      service
        .from("email_deliveries")
        .select(
          "submission_id,kind,status,idempotency_key,attempt_count,provider_message_id,sent_at",
        )
        .eq("submission_id", submissionId),
      service
        .from("certificates")
        .select("submission_id,status,object_path")
        .eq("submission_id", submissionId),
    ]);

  if (submissionResult.error || !submissionResult.data) {
    throw new Error("Could not verify the finalized staging submission.");
  }
  const submission = submissionResult.data;
  assert(
    submission.status === "pending_review" &&
      submission.display_name === DISPLAY_NAME &&
      submission.is_test === true &&
      submission.counts_toward_goal === false &&
      Boolean(submission.submitted_at) &&
      submission.guardian_number === null &&
      submission.approved_at === null &&
      submission.published_at === null &&
      submission.rejected_at === null,
    "The finalized staging record violated the Pending Review contract.",
  );

  assert(
    !contactsResult.error &&
      contactsResult.data?.length === 1 &&
      contactsResult.data[0].email === testEmail,
    "Contact idempotency verification failed.",
  );
  assert(
    !consentsResult.error &&
      consentsResult.data?.length === 1 &&
      consentsResult.data[0].publication_consent === true &&
      consentsResult.data[0].terms_accepted === true,
    "Consent idempotency verification failed.",
  );
  assert(!mediaResult.error && mediaResult.data?.length === 1, "Media idempotency verification failed.");
  const media = mediaResult.data[0];
  reviewThumbnailPath = media.review_thumbnail_path;
  publishedCardPath = media.published_card_path;
  publishedFullPath = media.published_full_path;
  assert(
    media.status === "uploaded" &&
      media.original_bucket === ORIGINALS_BUCKET &&
      media.original_path === originalPath &&
      media.original_mime_type === "image/jpeg" &&
      Number(media.original_bytes) === image.byteLength &&
      media.original_width === 640 &&
      media.original_height === 800 &&
      /^[0-9a-f]{64}$/.test(media.original_checksum_sha256 ?? "") &&
      Boolean(media.uploaded_at) &&
      typeof reviewThumbnailPath === "string" &&
      media.review_thumbnail_width === 240 &&
      media.review_thumbnail_height === 300 &&
      Number(media.review_thumbnail_bytes) > 0 &&
      Boolean(media.review_thumbnail_generated_at) &&
      media.published_bucket === null &&
      publishedCardPath === null &&
      publishedFullPath === null &&
      media.published_at === null,
    "The verified private media record violated the Pending Review contract.",
  );

  assert(
    !deliveriesResult.error &&
      deliveriesResult.data?.length === 1 &&
      deliveriesResult.data[0].kind === "submission_received" &&
      deliveriesResult.data[0].status === "not_started" &&
      deliveriesResult.data[0].idempotency_key === `submission_received:${submissionId}` &&
      deliveriesResult.data[0].attempt_count === 0 &&
      deliveriesResult.data[0].provider_message_id === null &&
      deliveriesResult.data[0].sent_at === null,
    "Email placeholder idempotency or no-send verification failed.",
  );
  assert(
    !certificatesResult.error && certificatesResult.data?.length === 0,
    "A certificate was unexpectedly created for Pending Review.",
  );

  assert(await objectExists(ORIGINALS_BUCKET, originalPath), "The private original was not found.");
  assert(
    await objectExists(ORIGINALS_BUCKET, reviewThumbnailPath),
    "The private review thumbnail was not found.",
  );
  const { data: originalBucket, error: originalBucketError } =
    await service.storage.getBucket(ORIGINALS_BUCKET);
  if (originalBucketError || originalBucket?.public !== false) {
    throw new Error("The submission originals bucket is not confirmed private.");
  }

  const duringSummary = await campaignSummary();
  assert(
    duringSummary.currentCount === baselineSummary.currentCount &&
      duringSummary.targetCount === baselineSummary.targetCount,
    "The public campaign metric changed during the smoke test.",
  );
  const duringMovement = await movementSnapshot();
  assert(duringMovement === baselineMovement, "The public Movement Wall changed during the smoke test.");
  assert(!duringMovement.includes(DISPLAY_NAME), "The synthetic submission appeared publicly.");
} finally {
  if (submissionId) {
    const { data: mediaRows } = await service
      .from("submission_media")
      .select("review_thumbnail_path,published_card_path,published_full_path")
      .eq("submission_id", submissionId);
    const media = mediaRows?.[0];
    reviewThumbnailPath ??= media?.review_thumbnail_path ?? null;
    publishedCardPath ??= media?.published_card_path ?? null;
    publishedFullPath ??= media?.published_full_path ?? null;

    const { data: certificateRows } = await service
      .from("certificates")
      .select("object_path")
      .eq("submission_id", submissionId);
    certificatePath ??= certificateRows?.[0]?.object_path ?? null;
  }

  await removeIfPresent(ORIGINALS_BUCKET, originalPath);
  await removeIfPresent(ORIGINALS_BUCKET, reviewThumbnailPath);
  await removeIfPresent(PUBLISHED_BUCKET, publishedCardPath);
  await removeIfPresent(PUBLISHED_BUCKET, publishedFullPath);
  await removeIfPresent(CERTIFICATES_BUCKET, certificatePath);

  if (submissionId) {
    const { error } = await service
      .from("submissions")
      .delete()
      .eq("id", submissionId)
      .eq("is_test", true)
      .eq("counts_toward_goal", false);
    if (error) throw new Error("Database cleanup failed.");

    const relatedTables = [
      "submissions",
      "submission_contacts",
      "submission_consents",
      "submission_media",
      "email_deliveries",
      "certificates",
    ];
    for (const table of relatedTables) {
      const column = table === "submissions" ? "id" : "submission_id";
      const { count, error: countError } = await service
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq(column, submissionId);
      if (countError || count !== 0) throw new Error(`${table} cleanup verification failed.`);
    }
  }

  if (typeof originalOpenState === "boolean") {
    const { error } = await service
      .from("campaign_settings")
      .update({ submissions_open: originalOpenState })
      .eq("id", 1);
    if (error) throw new Error("Campaign state restoration failed.");
  }

  if (baselineSummary) {
    const restoredSummary = await campaignSummary();
    assert(
      restoredSummary.currentCount === baselineSummary.currentCount &&
        restoredSummary.targetCount === baselineSummary.targetCount &&
        restoredSummary.submissionsOpen === baselineSummary.submissionsOpen,
      "The campaign summary did not return to its baseline.",
    );
    assert(
      (await movementSnapshot()) === baselineMovement,
      "The Movement Wall did not return to its baseline.",
    );
  }
  cleanupComplete = true;
}

console.log(
  JSON.stringify({
    gate: "section-3-staging-submission",
    submissionId,
    status: "passed",
    pendingReview: "verified",
    idempotency: "verified",
    originalPrivate: "verified",
    reviewThumbnail: "verified",
    certificate: "not-created",
    email: "not-sent",
    movementWall: "unchanged",
    baselineCount: baselineSummary.currentCount,
    finalCount: baselineSummary.currentCount,
    targetCount: baselineSummary.targetCount,
    submissionsOpenRestored: true,
    cleanup: cleanupComplete ? "complete" : "incomplete",
  }),
);
