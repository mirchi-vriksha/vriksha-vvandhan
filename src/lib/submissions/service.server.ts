import "server-only";

import { z } from "zod";

import { PUBLIC_SUBMISSION } from "@/config/public-submission";
import { createOriginalSignedUpload } from "@/lib/storage/signed-upload.server";
import { SUBMISSION_ORIGINALS_BUCKET } from "@/lib/storage/buckets";
import {
  generateReviewThumbnail,
  uploadReviewThumbnail,
} from "@/lib/storage/review-thumbnail.server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { callUntypedRpc } from "@/lib/supabase/rpc.server";
import { mapDatabaseError } from "@/lib/submissions/api-errors";
import { hashPublicRequestToken } from "@/lib/submissions/request-token.server";
import type {
  FinalizeSubmissionRequest,
  PrepareSubmissionRequest,
  PrepareSubmissionResponse,
  PublicApiErrorCode,
} from "@/lib/submissions/schemas";
import {
  UploadedImageVerificationError,
  verifyUploadedImage,
} from "@/lib/submissions/verify-uploaded-image.server";

const prepareRpcRowSchema = z.object({
  submission_id: z.uuid(),
  status: z.enum(["draft", "pending_review"]),
  original_path: z.string().min(1).max(500),
  original_extension: z.enum(["webp", "jpg"]),
  draft_expires_at: z.iso.datetime({ offset: true }),
});

const finaliseRpcRowSchema = z.object({
  submission_id: z.uuid(),
  status: z.literal("pending_review"),
});

export class SubmissionServiceError extends Error {
  constructor(public readonly code: PublicApiErrorCode) {
    super(code);
    this.name = "SubmissionServiceError";
  }
}

async function privateObjectExists(path: string): Promise<boolean> {
  const slash = path.lastIndexOf("/");
  const folder = path.slice(0, slash);
  const fileName = path.slice(slash + 1);
  const { data, error } = await getServiceSupabaseClient()
    .storage.from(SUBMISSION_ORIGINALS_BUCKET)
    .list(folder, { limit: 2, search: fileName });

  if (error) throw new SubmissionServiceError("temporarily_unavailable");
  return data.some((object) => object.name === fileName);
}

async function removeDraft(submissionId: string, tokenHash: string): Promise<void> {
  const { error } = await getServiceSupabaseClient()
    .from("submissions")
    .delete()
    .eq("id", submissionId)
    .eq("public_request_token_hash", tokenHash)
    .eq("status", "draft");
  if (error) throw new SubmissionServiceError("temporarily_unavailable");
}

async function removeInvalidDraftObject(
  submissionId: string,
  tokenHash: string,
  path: string,
): Promise<void> {
  const { error } = await getServiceSupabaseClient()
    .storage.from(SUBMISSION_ORIGINALS_BUCKET)
    .remove([path]);
  if (error) throw new SubmissionServiceError("temporarily_unavailable");
  await removeDraft(submissionId, tokenHash);
}

export async function getPublicSubmissionAvailability(): Promise<
  "open" | "closed" | "unavailable"
> {
  try {
    const { data, error } = await getServiceSupabaseClient()
      .from("campaign_settings")
      .select("submissions_open")
      .eq("id", 1)
      .single();
    if (error || !data) return "unavailable";
    return data.submissions_open ? "open" : "closed";
  } catch {
    return "unavailable";
  }
}

export async function preparePublicSubmission(
  input: PrepareSubmissionRequest,
): Promise<PrepareSubmissionResponse> {
  const client = getServiceSupabaseClient();
  const tokenHash = hashPublicRequestToken(input.requestToken);

  const { data: priorDraft } = await client
    .from("submissions")
    .select("id")
    .eq("public_request_token_hash", tokenHash)
    .maybeSingle();

  const { data, error } = await client.rpc("prepare_public_submission", {
      p_public_request_token_hash: tokenHash,
      p_display_name: input.displayName,
      p_email: input.email,
      p_publication_consent: input.publicationConsent,
      p_terms_accepted: input.termsAccepted,
      p_consent_version: PUBLIC_SUBMISSION.consentVersion,
      p_original_extension: input.preparedExtension,
    });

  if (error) throw new SubmissionServiceError(mapDatabaseError(error));
  const row = prepareRpcRowSchema.parse(z.array(z.unknown()).parse(data)[0]);

  if (row.status === "pending_review") {
    return {
      submissionId: row.submission_id,
      status: row.status,
      draftExpiresAt: row.draft_expires_at,
      uploadRequired: false,
    };
  }

  const uploadRequired = !(await privateObjectExists(row.original_path));
  if (!uploadRequired) {
    return {
      submissionId: row.submission_id,
      status: row.status,
      draftExpiresAt: row.draft_expires_at,
      uploadRequired: false,
    };
  }

  try {
    const upload = await createOriginalSignedUpload(
      row.submission_id,
      row.original_extension,
    );
    return {
      submissionId: row.submission_id,
      status: row.status,
      draftExpiresAt: row.draft_expires_at,
      uploadRequired: true,
      upload,
    };
  } catch {
    if (!priorDraft) await removeDraft(row.submission_id, tokenHash);
    throw new SubmissionServiceError("temporarily_unavailable");
  }
}

export async function finalizePublicSubmission(
  input: FinalizeSubmissionRequest,
): Promise<{ success: true; status: "pending_review" }> {
  const client = getServiceSupabaseClient();
  const tokenHash = hashPublicRequestToken(input.requestToken);
  const { data: submission, error: loadError } = await client
    .from("submissions")
    .select("id,status,draft_expires_at,submission_media(original_path)")
    .eq("id", input.submissionId)
    .eq("public_request_token_hash", tokenHash)
    .maybeSingle();

  if (loadError) throw new SubmissionServiceError("temporarily_unavailable");
  if (!submission) throw new SubmissionServiceError("invalid_draft");
  if (submission.status === "pending_review") {
    return { success: true, status: "pending_review" };
  }
  if (submission.status !== "draft") throw new SubmissionServiceError("already_submitted");
  if (!submission.draft_expires_at || new Date(submission.draft_expires_at) <= new Date()) {
    throw new SubmissionServiceError("draft_expired");
  }

  const media = Array.isArray(submission.submission_media)
    ? submission.submission_media[0]
    : submission.submission_media;
  if (!media?.original_path) throw new SubmissionServiceError("media_not_ready");

  let verified;
  try {
    verified = await verifyUploadedImage(media.original_path);
  } catch (error) {
    if (error instanceof UploadedImageVerificationError && error.kind === "invalid") {
      await removeInvalidDraftObject(input.submissionId, tokenHash, media.original_path);
      throw new SubmissionServiceError("invalid_image");
    }
    throw new SubmissionServiceError("media_not_ready");
  }

  let storedThumbnail: {
    path: string;
    width: number;
    height: number;
    bytes: number;
    generatedAt: string;
  } | null = null;
  try {
    const thumbnail = await generateReviewThumbnail(verified.data);
    const stored = await uploadReviewThumbnail(input.submissionId, thumbnail);
    storedThumbnail = {
      path: stored.path,
      width: thumbnail.width,
      height: thumbnail.height,
      bytes: thumbnail.bytes,
      generatedAt: stored.generatedAt,
    };
  } catch {
    // The verified submission still enters review. A bounded staging backfill can
    // safely retry this private derivative without duplicating the submission.
  }

  const { data, error } = await callUntypedRpc<unknown>(client, "finalize_public_submission_with_review_thumbnail", {
      p_submission_id: input.submissionId,
      p_public_request_token_hash: tokenHash,
      p_verified_mime_type: verified.mimeType,
      p_verified_bytes: verified.bytes,
      p_verified_width: verified.width,
      p_verified_height: verified.height,
      p_verified_sha256: verified.sha256,
      p_review_thumbnail_path: storedThumbnail?.path ?? null,
      p_review_thumbnail_width: storedThumbnail?.width ?? null,
      p_review_thumbnail_height: storedThumbnail?.height ?? null,
      p_review_thumbnail_bytes: storedThumbnail?.bytes ?? null,
      p_review_thumbnail_generated_at: storedThumbnail?.generatedAt ?? null,
    });
  if (error) {
    if (storedThumbnail) {
      await client.storage
        .from(SUBMISSION_ORIGINALS_BUCKET)
        .remove([storedThumbnail.path])
        .catch(() => undefined);
    }
    throw new SubmissionServiceError(mapDatabaseError(error));
  }
  finaliseRpcRowSchema.parse(z.array(z.unknown()).parse(data)[0]);
  return { success: true, status: "pending_review" };
}
