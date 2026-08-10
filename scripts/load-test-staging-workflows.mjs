import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const PREPARE_COUNT = 20;
const FINALIZE_COUNT = 10;
const REVIEW_COUNT = 5;
const ORIGINALS_BUCKET = "submission-originals";
const ALLOWED_STAGING_PROJECT_REF = "oroaheeamreebbohexoc";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

if (!process.argv.includes("--execute")) {
  throw new Error("Dry safety stop. Pass --execute for the bounded staging workflow load test.");
}
if (process.env.SUPABASE_TARGET_ENVIRONMENT !== "staging") {
  throw new Error("Refusing to run outside SUPABASE_TARGET_ENVIRONMENT=staging.");
}
if (process.env.EMAIL_SENDING_ENABLED === "true") {
  throw new Error("Refusing to run while email sending is enabled.");
}
if (process.env.TURNSTILE_ENABLED !== "false") {
  throw new Error("Use a controlled staging window with TURNSTILE_ENABLED=false for this synthetic test.");
}

const siteUrl = new URL(required("NEXT_PUBLIC_SITE_URL"));
const supabaseUrl = new URL(required("NEXT_PUBLIC_SUPABASE_URL"));
const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const secretKey = required("SUPABASE_SECRET_KEY");
if (!["127.0.0.1", "localhost"].includes(siteUrl.hostname)) {
  throw new Error("The workflow load harness must call a local application server.");
}
if (!supabaseUrl.hostname.endsWith(".supabase.co") || /prod/i.test(supabaseUrl.hostname)) {
  throw new Error("The workflow load harness requires the allowlisted hosted staging backend.");
}
const refPath = "supabase/.temp/project-ref";
if (!existsSync(refPath)) throw new Error("The repository is not linked to staging.");
const linkedRef = readFileSync(refPath, "utf8").trim();
if (
  linkedRef !== ALLOWED_STAGING_PROJECT_REF
  || linkedRef !== supabaseUrl.hostname.split(".")[0]
) {
  throw new Error("The linked project does not match the configured staging URL.");
}

const service = createClient(supabaseUrl.toString(), secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicClient = createClient(supabaseUrl.toString(), publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const runId = randomUUID();
const submissions = [];
const objectPaths = [];
let staffUserId = null;
let initialOpen = null;
let initialCount = null;

const image = await sharp({
  create: { width: 640, height: 800, channels: 3, background: { r: 35, g: 91, b: 63 } },
}).jpeg({ quality: 80 }).toBuffer();

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0);
}

async function must(promise, message) {
  const result = await promise;
  if (result.error) throw new Error(`${message} [${result.error.code ?? "remote_error"}]`);
  return result.data;
}

async function summary() {
  const rows = await must(publicClient.rpc("get_public_campaign_summary"), "Campaign summary failed.");
  const row = rows?.[0];
  if (!row) throw new Error("Campaign summary returned no row.");
  return { count: Number(row.current_count), open: Boolean(row.submissions_open) };
}

async function post(path, body, index) {
  const started = performance.now();
  const response = await fetch(new URL(path, siteUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: siteUrl.origin,
      "x-vercel-forwarded-for": `198.18.0.${index + 1}`,
      "User-Agent": "Vriksha-Vvandhan-Section-6-Bounded-Staging-Load-Test",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}.`);
  return { payload, milliseconds: performance.now() - started };
}

async function removeObjects(paths) {
  if (!paths.length) return;
  const unique = [...new Set(paths)];
  const result = await service.storage.from(ORIGINALS_BUCKET).remove(unique);
  if (result.error) throw new Error("Synthetic Storage cleanup failed.");
  for (const path of unique) {
    const slash = path.lastIndexOf("/");
    const folder = path.slice(0, slash);
    const name = path.slice(slash + 1);
    const listed = await service.storage.from(ORIGINALS_BUCKET).list(folder, { search: name, limit: 2 });
    if (listed.error || listed.data.some((item) => item.name === name)) {
      throw new Error("Synthetic Storage cleanup verification failed.");
    }
  }
}

try {
  const baseline = await summary();
  initialOpen = baseline.open;
  initialCount = baseline.count;
  if (!initialOpen) {
    await must(service.from("campaign_settings").update({ submissions_open: true }).eq("id", 1), "Could not open the staging test window.");
  }

  const prepared = await Promise.all(Array.from({ length: PREPARE_COUNT }, async (_, index) => {
    const requestToken = randomBytes(32).toString("hex");
    const result = await post("/api/submissions/prepare", {
      displayName: `SECTION 6 LOAD ${String(index + 1).padStart(2, "0")}`,
      email: `section6-load-${runId}-${index}@example.invalid`,
      publicationConsent: true,
      termsAccepted: true,
      requestToken,
      preparedExtension: "jpg",
    }, index);
    assert(result.payload?.status === "draft" && result.payload?.uploadRequired === true, "Prepare contract failed.");
    const record = { index, requestToken, submissionId: result.payload.submissionId, upload: result.payload.upload };
    submissions.push(record);
    objectPaths.push(result.payload.upload.path);
    return { ...record, milliseconds: result.milliseconds };
  }));
  assert(new Set(prepared.map((item) => item.submissionId)).size === PREPARE_COUNT, "Prepare created duplicate submission IDs.");

  for (const item of prepared) {
    const tokenHash = createHash("sha256").update(item.requestToken).digest("hex");
    const marked = await must(
      service.from("submissions").update({ is_test: true, counts_toward_goal: false })
        .eq("id", item.submissionId).eq("public_request_token_hash", tokenHash).select("id").single(),
      "Could not mark a synthetic load row.",
    );
    assert(marked.id === item.submissionId, "Synthetic marker verification failed.");
  }

  const finalized = await Promise.all(prepared.slice(0, FINALIZE_COUNT).map(async (item) => {
    const uploadStarted = performance.now();
    const upload = await publicClient.storage.from(ORIGINALS_BUCKET).uploadToSignedUrl(
      item.upload.path,
      item.upload.token,
      new File([image], `section6-load-${item.index}.jpg`, { type: "image/jpeg" }),
      { contentType: "image/jpeg", cacheControl: "3600" },
    );
    if (upload.error) throw new Error("Signed upload failed during bounded load.");
    const uploadMilliseconds = performance.now() - uploadStarted;
    const result = await post("/api/submissions/finalize", {
      submissionId: item.submissionId,
      requestToken: item.requestToken,
    }, item.index);
    assert(result.payload?.status === "pending_review", "Finalize contract failed.");
    return { ...item, uploadMilliseconds, finalizeMilliseconds: result.milliseconds };
  }));

  const password = `${randomBytes(28).toString("base64url")}Aa1!`;
  const staffEmail = `section6-reviewer-${runId}@example.invalid`;
  const created = await must(service.auth.admin.createUser({
    email: staffEmail,
    password,
    email_confirm: true,
    app_metadata: { section6_load_test: runId },
  }), "Could not create the temporary reviewer.");
  staffUserId = created.user.id;
  await must(service.from("staff_profiles").insert({ id: staffUserId, display_name: "Section 6 Load Reviewer", role: "reviewer", active: true }), "Could not create the temporary reviewer profile.");
  const reviewer = createClient(supabaseUrl.toString(), publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await must(reviewer.auth.signInWithPassword({ email: staffEmail, password }), "Temporary reviewer sign-in failed.");
  const reviewStarted = performance.now();
  await Promise.all(finalized.slice(0, REVIEW_COUNT).map((item) => must(reviewer.rpc("update_submission_review_fields", {
    p_submission_id: item.submissionId,
    p_display_name: `SECTION 6 REVIEWED ${String(item.index + 1).padStart(2, "0")}`,
    p_focal_x: 0.5,
    p_focal_y: 0.5,
  }), "Concurrent reviewer action failed.")));
  const reviewMilliseconds = performance.now() - reviewStarted;

  const ids = prepared.map((item) => item.submissionId);
  const rows = await must(service.from("submissions").select("id,status,guardian_number,is_test,counts_toward_goal").in("id", ids), "Synthetic row verification failed.");
  assert(rows.length === PREPARE_COUNT, "A prepared row was lost.");
  assert(rows.filter((row) => row.status === "pending_review").length === FINALIZE_COUNT, "Finalize count was not exact.");
  assert(rows.every((row) => row.guardian_number === null && row.is_test === true && row.counts_toward_goal === false), "Synthetic load affected publication invariants.");
  assert((await summary()).count === initialCount, "Synthetic load changed the public campaign count.");

  console.log(JSON.stringify({
    target: siteUrl.origin,
    safety: "bounded-staging-mutation-with-verified-cleanup",
    prepare: { requests: PREPARE_COUNT, p50Ms: percentile(prepared.map((item) => item.milliseconds), 0.5), p95Ms: percentile(prepared.map((item) => item.milliseconds), 0.95) },
    upload: { requests: FINALIZE_COUNT, p50Ms: percentile(finalized.map((item) => item.uploadMilliseconds), 0.5), p95Ms: percentile(finalized.map((item) => item.uploadMilliseconds), 0.95) },
    finalize: { requests: FINALIZE_COUNT, p50Ms: percentile(finalized.map((item) => item.finalizeMilliseconds), 0.5), p95Ms: percentile(finalized.map((item) => item.finalizeMilliseconds), 0.95) },
    reviewer: { concurrentActions: REVIEW_COUNT, totalMs: Math.round(reviewMilliseconds) },
    invariants: { uniqueSubmissions: true, guardianNumbersCreated: 0, publicCountUnchanged: true, emailSendingDisabled: true },
  }, null, 2));
} finally {
  if (submissions.length) {
    const ids = submissions.map((item) => item.submissionId);
    const media = await service.from("submission_media").select("review_thumbnail_path").in("submission_id", ids);
    for (const row of media.data ?? []) if (row.review_thumbnail_path) objectPaths.push(row.review_thumbnail_path);
    await removeObjects(objectPaths);
    await must(service.from("submissions").delete().in("id", ids).eq("is_test", true).eq("counts_toward_goal", false), "Synthetic row cleanup failed.");
    const remaining = await service.from("submissions").select("id", { count: "exact", head: true }).in("id", ids);
    if (remaining.error || remaining.count !== 0) throw new Error("Synthetic row cleanup verification failed.");
  }
  if (staffUserId) await must(service.auth.admin.deleteUser(staffUserId), "Temporary reviewer cleanup failed.");
  if (typeof initialOpen === "boolean") {
    await must(service.from("campaign_settings").update({ submissions_open: initialOpen }).eq("id", 1), "Campaign-open state restoration failed.");
  }
  if (typeof initialCount === "number") {
    const restored = await summary();
    if (restored.count !== initialCount || restored.open !== initialOpen) {
      throw new Error("Staging state did not return to the recorded baseline.");
    }
  }
}
