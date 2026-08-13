import "server-only";

import { requireStaff } from "@/lib/auth/dal";
import {
  createOriginalReviewUrl,
  createReviewThumbnailUrls,
} from "@/lib/storage/signed-review-url.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isStaffE2EAdapterEnabled } from "@/lib/testing/staff-adapter";

const E2E_PENDING_ID = "e1000000-0000-4000-8000-000000000001";
const E2E_RECOMMENDED_ID = "e1000000-0000-4000-8000-000000000002";
const E2E_TRASHED_ID = "e1000000-0000-4000-8000-000000000003";
const E2E_SUBMITTED_AT = "2026-08-06T10:00:00.000Z";

export function e2eQueueFixtures(): QueueSubmission[] {
  return [
    { id:E2E_PENDING_ID,status:"pending_review",display_name:"Asha Test",submitted_at:E2E_SUBMITTED_AT,submittedLabel:"06/08/2026",guardian_number:null,source:"internal_test",is_test:true,trashed_at:null,thumbnailAvailable:true,reviewAgeHours:2 },
    { id:E2E_RECOMMENDED_ID,status:"rejection_pending_admin",display_name:"Ravi Test",submitted_at:E2E_SUBMITTED_AT,submittedLabel:"06/08/2026",guardian_number:null,source:"internal_test",is_test:true,trashed_at:null,thumbnailAvailable:true,reviewAgeHours:2 },
    { id:E2E_TRASHED_ID,status:"published",display_name:"Meera Test",submitted_at:E2E_SUBMITTED_AT,submittedLabel:"06/08/2026",guardian_number:77,source:"internal_test",is_test:true,trashed_at:"2026-08-06T11:00:00.000Z",thumbnailAvailable:false,reviewAgeHours:2 },
  ];
}

export type QueueSubmission = {
  id: string; status: string; display_name: string | null; submitted_at: string | null;
  submittedLabel: string | null;
  guardian_number: number | null; source: string; is_test: boolean; trashed_at: string | null;
  thumbnailAvailable: boolean; reviewAgeHours: number | null;
};

type SubmissionCursor = { submittedAt: string; id: string };

function decodeSubmissionCursor(value: string | undefined): SubmissionCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<SubmissionCursor>;
    if (
      typeof parsed.submittedAt !== "string" ||
      Number.isNaN(Date.parse(parsed.submittedAt)) ||
      typeof parsed.id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(parsed.id)
    ) return null;
    return { submittedAt: new Date(parsed.submittedAt).toISOString(), id: parsed.id };
  } catch {
    return null;
  }
}

function encodeSubmissionCursor(cursor: SubmissionCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export async function getOldestUnreviewedAgeHours() {
  await requireStaff();
  if (isStaffE2EAdapterEnabled()) return 2;
  const client = await createServerSupabaseClient();
  const { data } = await client.from("submissions").select("submitted_at").eq("status", "pending_review").is("trashed_at", null).order("submitted_at", { ascending: true, nullsFirst: false }).limit(1).maybeSingle();
  return data?.submitted_at ? Math.max(0, Math.floor((Date.now() - new Date(data.submitted_at).getTime()) / 3_600_000)) : null;
}

export async function getSubmissionCounts() {
  const session = await requireStaff();
  if (isStaffE2EAdapterEnabled()) return { pending_review:1,rejection_pending_admin:1,published:1,rejected:0,trashed:1,certificate_not_started:1,certificate_generated:1,certificate_failed:1,email_not_started_or_failed:1,approval_email_sent:1,rejection_email_sent:1,email_failed:1 };
  const client = await createServerSupabaseClient();
  const statuses = ["pending_review", "rejection_pending_admin", "published", "rejected"] as const;
  const pairs = await Promise.all(statuses.map(async (status) => {
    const { count } = await client.from("submissions").select("id", { count: "exact", head: true }).eq("status", status).is("trashed_at", null);
    return [status, count ?? 0] as const;
  }));
  const { count: trashed } = await client.from("submissions").select("id", { count: "exact", head: true }).not("trashed_at", "is", null);
  let certificateNotStarted = 0;
  let certificateGenerated = 0;
  let certificateFailed = 0;
  let emailNotStartedOrFailed = 0;
  let approvalEmailSent = 0;
  let rejectionEmailSent = 0;
  let emailFailed = 0;
  if (session.role === "admin") {
    const [certificates, generated, certificateFailures, emails, approvalSent, rejectionSent, emailFailures] = await Promise.all([
      client.from("certificates").select("id", { count: "exact", head: true }).eq("status", "not_started"),
      client.from("certificates").select("id", { count: "exact", head: true }).eq("status", "generated"),
      client.from("certificates").select("id", { count: "exact", head: true }).eq("status", "failed"),
      client.from("email_deliveries").select("id", { count: "exact", head: true }).in("status", ["not_started", "failed"]),
      client.from("email_deliveries").select("id", { count: "exact", head: true }).eq("kind", "approval_certificate").eq("status", "sent"),
      client.from("email_deliveries").select("id", { count: "exact", head: true }).eq("kind", "rejection").eq("status", "sent"),
      client.from("email_deliveries").select("id", { count: "exact", head: true }).eq("status", "failed"),
    ]);
    certificateNotStarted = certificates.count ?? 0;
    certificateGenerated = generated.count ?? 0;
    certificateFailed = certificateFailures.count ?? 0;
    emailNotStartedOrFailed = emails.count ?? 0;
    approvalEmailSent = approvalSent.count ?? 0;
    rejectionEmailSent = rejectionSent.count ?? 0;
    emailFailed = emailFailures.count ?? 0;
  }
  return {
    ...Object.fromEntries(pairs), trashed: trashed ?? 0,
    certificate_not_started: certificateNotStarted,
    certificate_generated: certificateGenerated,
    certificate_failed: certificateFailed,
    email_not_started_or_failed: emailNotStartedOrFailed,
    approval_email_sent: approvalEmailSent,
    rejection_email_sent: rejectionEmailSent,
    email_failed: emailFailed,
  } as Record<(typeof statuses)[number] | "trashed" | "certificate_not_started" | "certificate_generated" | "certificate_failed" | "email_not_started_or_failed" | "approval_email_sent" | "rejection_email_sent" | "email_failed", number>;
}

export async function listSubmissionPage(status: string, search: string, rawCursor?: string) {
  const session = await requireStaff();
  if (isStaffE2EAdapterEnabled()) {
    const fixtures = e2eQueueFixtures();
    let items: QueueSubmission[];
    if (status === "trashed") items = session.role === "admin" ? fixtures.filter((item) => item.trashed_at) : [];
    else if (status === "all") items = fixtures.filter((item) => !item.trashed_at);
    else if (status === "test") items = fixtures;
    else items = fixtures.filter((item) => !item.trashed_at && item.status === status && (!search || item.display_name?.toLowerCase().includes(search.toLowerCase())));
    return { items, nextCursor: null };
  }
  const client = await createServerSupabaseClient();
  const normalizedSearch = search.trim();
  let emailSubmissionIds: string[] | null = null;
  if (normalizedSearch.includes("@") && session.role === "admin") {
    const { data: contacts, error } = await client.from("submission_contacts").select("submission_id").ilike("email", normalizedSearch);
    if (error) throw new Error("Unable to search participant contacts.");
    emailSubmissionIds = (contacts ?? []).map((contact) => contact.submission_id);
    if (!emailSubmissionIds.length) return { items: [], nextCursor: null };
  }
  let query = client.from("submissions").select("id,status,display_name,submitted_at,guardian_number,source,is_test,trashed_at,submission_media(review_thumbnail_path)")
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .limit(26);
  if (status === "trashed" && session.role === "admin") query = query.not("trashed_at", "is", null);
  else {
    query = query.is("trashed_at", null);
    if (["pending_review", "rejection_pending_admin", "published", "rejected"].includes(status)) query = query.eq("status", status as "pending_review");
    if (status === "test") query = query.eq("is_test", true);
  }
  if (emailSubmissionIds) query = query.in("id", emailSubmissionIds);
  else if (normalizedSearch) {
    const guardian = Number(normalizedSearch);
    query = Number.isSafeInteger(guardian) && guardian > 0 ? query.eq("guardian_number", guardian) : query.ilike("display_name", `%${normalizedSearch.replaceAll("%", "")}%`);
  }
  const cursor = decodeSubmissionCursor(rawCursor);
  if (cursor) {
    query = query.or(`submitted_at.lt.${cursor.submittedAt},and(submitted_at.eq.${cursor.submittedAt},id.lt.${cursor.id})`);
  }
  const { data, error } = await query;
  if (error) throw new Error("Unable to load the moderation queue.");
  const pageRows = (data ?? []).slice(0, 25);
  const items = pageRows.map((item) => {
    const relation = item.submission_media;
    const media = Array.isArray(relation) ? relation[0] : relation;
    const reviewAgeHours = item.submitted_at ? Math.max(0, Math.floor((Date.now() - new Date(item.submitted_at).getTime()) / 3_600_000)) : null;
    const { submission_media: _privateMedia, ...safeItem } = item;
    void _privateMedia;
    return {
      ...safeItem,
      submittedLabel: item.submitted_at ? new Date(item.submitted_at).toLocaleDateString("en-IN") : null,
      thumbnailAvailable: Boolean(media?.review_thumbnail_path),
      reviewAgeHours,
    } as QueueSubmission;
  });
  const last = pageRows.at(-1);
  return {
    items,
    nextCursor:
      (data?.length ?? 0) > 25 && last?.submitted_at
        ? encodeSubmissionCursor({ submittedAt: last.submitted_at, id: last.id })
        : null,
  };
}

export async function listSubmissions(status: string, search: string) {
  return (await listSubmissionPage(status, search)).items;
}

export async function getSignedQueueThumbnails(submissionIds: readonly string[]) {
  await requireStaff();
  const ids = [...new Set(submissionIds)].slice(0, 25);
  if (!ids.length) return new Map<string, string | null>();
  if (isStaffE2EAdapterEnabled()) {
    return new Map(ids.map((id) => [
      id,
      id === E2E_PENDING_ID
        ? "/api/testing/review-thumbnail?mode=delayed"
        : id === E2E_RECOMMENDED_ID
          ? "/api/testing/review-thumbnail?mode=broken"
          : null,
    ]));
  }

  const client = await createServerSupabaseClient();
  const { data, error } = await client
    .from("submission_media")
    .select("submission_id,review_thumbnail_path")
    .in("submission_id", ids);
  if (error) throw new Error("Unable to load private review-thumbnail metadata.");

  const pathBySubmission = new Map(
    (data ?? [])
      .filter((item): item is typeof item & { review_thumbnail_path: string } => Boolean(item.review_thumbnail_path))
      .map((item) => [item.submission_id, item.review_thumbnail_path]),
  );
  const signedByPath = await createReviewThumbnailUrls([...pathBySubmission.values()]);
  return new Map(ids.map((id) => {
    const path = pathBySubmission.get(id);
    return [id, path ? signedByPath.get(path) ?? null : null];
  }));
}

export async function getSubmissionDetail(id: string) {
  const session = await requireStaff();
  if (isStaffE2EAdapterEnabled()) {
    const fixture = e2eQueueFixtures().find((item) => item.id === id);
    if (!fixture) return null;
    const record = {
      id:fixture.id,status:fixture.status,display_name:fixture.display_name,submitted_at:fixture.submitted_at,guardian_number:fixture.guardian_number,
      rejection_comment:fixture.status === "rejection_pending_admin" ? "Please review this generated test image." : null,
      rejection_recommended_at:fixture.status === "rejection_pending_admin" ? "2026-08-06T11:00:00.000Z" : null,rejected_at:null,trashed_at:fixture.trashed_at,
      submission_consents:{publication_consent:true,terms_accepted:true,accepted_at:E2E_SUBMITTED_AT},
      submission_media:{status:fixture.status === "published" ? "published" : "uploaded",original_path:`${fixture.id}/original.webp`,original_mime_type:"image/webp",original_bytes:2048,original_width:900,original_height:900,review_thumbnail_path:`${fixture.id}/review-thumb.webp`,review_thumbnail_width:240,review_thumbnail_height:300,review_thumbnail_bytes:4096,focal_x:.5,focal_y:.5,published_card_path:null,published_full_path:null},
      certificates:{id:"c1000000-0000-4000-8000-000000000001",status:"not_started",template_version:null,generated_at:null,last_error_code:null},email_deliveries:[{id:"d1000000-0000-4000-8000-000000000001",kind:"approval_certificate",status:"not_started",sent_at:null,last_error_code:null}],
    };
    return { record, reviewThumbnail:{bucket:"submission-originals",path:`${fixture.id}/review-thumb.webp`,signedUrl:"/campaign/guardian-preview.webp",expiresIn:600}, reviewImage:{bucket:"submission-originals",path:`${fixture.id}/original.webp`,signedUrl:"/campaign/guardian-preview.webp",expiresIn:600}, email:session.role === "admin" ? "participant@example.test" : null, audit:session.role === "admin" ? [{id:1,action:"submission.test_fixture",created_at:E2E_SUBMITTED_AT}] : [], session };
  }
  const client = await createServerSupabaseClient();
  const { data, error } = await client.from("submissions").select("id,status,display_name,submitted_at,guardian_number,rejection_comment,rejection_recommended_at,rejected_at,trashed_at,submission_consents(publication_consent,terms_accepted,accepted_at),submission_media(status,original_path,original_mime_type,original_bytes,original_width,original_height,review_thumbnail_path,review_thumbnail_width,review_thumbnail_height,review_thumbnail_bytes,focal_x,focal_y,published_card_path,published_full_path),certificates(id,status,template_version,generated_at,last_error_code),email_deliveries(id,kind,status,sent_at,last_error_code)").eq("id", id).maybeSingle();
  if (error || !data) return null;
  const record = data as unknown as Record<string, unknown> & {
    submission_media:
      | { original_path: string; review_thumbnail_path: string | null }
      | { original_path: string; review_thumbnail_path: string | null }[];
  };
  const media = Array.isArray(record.submission_media) ? record.submission_media[0] : record.submission_media;
  const reviewThumbnailPath = media?.review_thumbnail_path ?? null;
  const adminDataPromise = session.role === "admin"
    ? Promise.all([
        client.from("submission_contacts").select("email").eq("submission_id", id).maybeSingle(),
        client.from("audit_logs").select("id,action,reason,before_data,after_data,created_at").eq("entity_id", id).order("created_at", { ascending: false }).limit(30),
      ])
    : Promise.resolve(null);
  const [reviewThumbnail, reviewImage, adminData] = await Promise.all([
    reviewThumbnailPath
      ? createReviewThumbnailUrls([reviewThumbnailPath]).then((urls) => {
          const signedUrl = urls.get(reviewThumbnailPath);
          return signedUrl ? { bucket: "submission-originals" as const, path: reviewThumbnailPath, signedUrl, expiresIn: 600 } : null;
        }).catch(() => null)
      : null,
    media?.original_path ? createOriginalReviewUrl(media.original_path).catch(() => null) : null,
    adminDataPromise,
  ]);
  const email = adminData?.[0].data?.email ?? null;
  const audit = adminData?.[1].data ?? [];
  return { record, reviewThumbnail, reviewImage, email, audit, session };
}
