"use server";

import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole, requireStaff } from "@/lib/auth/dal";
import { createStaffMemberSchema } from "@/lib/auth/staff-management";
import { processApprovalDelivery, processSubmissionDelivery } from "@/lib/email/delivery-orchestration.server";
import { publishSubmission } from "@/lib/moderation/publication.server";
import { generatePublicVariants } from "@/lib/moderation/publication-image.server";
import { deletionSchema, rejectionSchema, reviewFieldsSchema, submissionIdSchema } from "@/lib/moderation/schemas";
import { CAMPAIGN_PUBLIC_TAG } from "@/lib/public-campaign/data";
import { PUBLISHED_IMAGES_BUCKET, SUBMISSION_ORIGINALS_BUCKET, CERTIFICATES_BUCKET } from "@/lib/storage/buckets";
import { buildPublishedCardPath, buildPublishedFullPath, parseStoredOriginalPath, parseStoredReviewThumbnailPath } from "@/lib/storage/paths";
import { callUntypedRpc } from "@/lib/supabase/rpc.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { isStaffE2EAdapterEnabled } from "@/lib/testing/staff-adapter";

type ImmediateDeliveryResult = "sent" | "disabled" | "retrying";

async function attemptImmediateDelivery(
  attempt: () => Promise<{ outcome: "disabled" | "not_eligible" | "suppressed" | "sent" }>,
  failureMessage: string,
): Promise<ImmediateDeliveryResult> {
  try {
    const result = await attempt();
    if (result.outcome === "sent") return "sent";
    if (result.outcome === "disabled") return "disabled";
  } catch {
    console.error(failureMessage);
  }
  return "retrying";
}

export async function saveReviewFieldsAction(formData: FormData) {
  await requireStaff();
  const input = reviewFieldsSchema.parse({ submissionId: formData.get("submissionId"), displayName: formData.get("displayName"), focalX: formData.get("focalX"), focalY: formData.get("focalY") });
  if (isStaffE2EAdapterEnabled()) redirect(`/admin/submissions/${input.submissionId}?testAction=fields-saved`);
  const client = await createServerSupabaseClient();
  const { error } = await callUntypedRpc(client, "update_submission_review_fields", { p_submission_id: input.submissionId, p_display_name: input.displayName, p_focal_x: input.focalX, p_focal_y: input.focalY });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/submissions/${input.submissionId}`);
  redirect(`/admin/submissions/${input.submissionId}?success=fields-saved`);
}

export async function approveSubmissionAction(formData: FormData) {
  const session = await requireStaff();
  const submissionId = submissionIdSchema.parse(formData.get("submissionId"));
  if (isStaffE2EAdapterEnabled()) redirect(`/admin/submissions/${submissionId}?success=published`);
  const client = await createServerSupabaseClient();
  await publishSubmission(client, session, submissionId);
  const delivery = await attemptImmediateDelivery(
    () => processApprovalDelivery(submissionId),
    "Approval delivery attempt failed; durable retry remains queued.",
  );
  redirect(`/admin/submissions/${submissionId}?success=published&delivery=${delivery}`);
}

export async function recommendRejectionAction(formData: FormData) {
  await requireRole("reviewer");
  const input = rejectionSchema.parse({ submissionId: formData.get("submissionId"), reasonCode: formData.get("reasonCode"), participantNote: formData.get("participantNote") ?? "", internalNote: formData.get("internalNote") });
  if (isStaffE2EAdapterEnabled()) redirect(`/admin/submissions/${input.submissionId}?testAction=recommended`);
  const client = await createServerSupabaseClient();
  const { error } = await callUntypedRpc(client, "recommend_submission_rejection", { p_submission_id: input.submissionId, p_reason_code: input.reasonCode, p_participant_note: input.participantNote, p_internal_note: input.internalNote });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/submissions/${input.submissionId}`);
  redirect(`/admin/submissions/${input.submissionId}?success=rejection-recommended`);
}

export async function confirmRejectionAction(formData: FormData) {
  await requireRole("admin");
  const input = rejectionSchema.parse({ submissionId: formData.get("submissionId"), reasonCode: formData.get("reasonCode"), participantNote: formData.get("participantNote") ?? "", internalNote: formData.get("internalNote") });
  if (isStaffE2EAdapterEnabled()) redirect(`/admin/submissions/${input.submissionId}?testAction=rejected`);
  const client = await createServerSupabaseClient();
  const { error } = await callUntypedRpc(client, "confirm_submission_rejection", { p_submission_id: input.submissionId, p_reason_code: input.reasonCode, p_participant_note: input.participantNote, p_internal_note: input.internalNote });
  if (error) throw new Error(error.message);
  const delivery = await attemptImmediateDelivery(
    () => processSubmissionDelivery(input.submissionId, "rejection"),
    "Rejection delivery attempt failed; durable retry remains queued.",
  );
  revalidatePath(`/admin/submissions/${input.submissionId}`);
  redirect(`/admin/submissions/${input.submissionId}?success=rejected&delivery=${delivery}`);
}

export async function trashSubmissionAction(formData: FormData) {
  await requireRole("admin");
  const id = submissionIdSchema.parse(formData.get("submissionId"));
  if (isStaffE2EAdapterEnabled()) redirect(`/admin/submissions/${id}?testAction=trashed`);
  const client = await createServerSupabaseClient();
  const { data, error } = await callUntypedRpc<Array<{ workflow_status: string; card_path: string | null; full_path: string | null }>>(client, "trash_submission", { p_submission_id: id });
  if (error) throw new Error(error.message);
  revalidateTag(CAMPAIGN_PUBLIC_TAG, "max");
  const paths = [data?.[0]?.card_path, data?.[0]?.full_path].filter((value): value is string => Boolean(value));
  if (paths.length) {
    const cleanup = await getServiceSupabaseClient().storage.from(PUBLISHED_IMAGES_BUCKET).remove(paths);
    if (cleanup.error) redirect(`/admin/submissions/${id}?cleanup=required`);
  }
  revalidatePath("/admin");
  redirect("/admin/submissions?status=trashed&result=trashed");
}

export async function restoreNonpublishedAction(formData: FormData) {
  await requireRole("admin");
  const id = submissionIdSchema.parse(formData.get("submissionId"));
  if (isStaffE2EAdapterEnabled()) redirect(`/admin/submissions/${id}?testAction=restored`);
  const client = await createServerSupabaseClient();
  const { error } = await callUntypedRpc(client, "restore_nonpublished_submission", { p_submission_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/submissions");
  redirect(`/admin/submissions/${id}?success=restored`);
}

export async function restorePublishedAction(formData: FormData) {
  await requireRole("admin");
  const id = submissionIdSchema.parse(formData.get("submissionId"));
  if (isStaffE2EAdapterEnabled()) redirect(`/admin/submissions/${id}?testAction=restored`);
  const client = await createServerSupabaseClient();
  const queryClient = client as unknown as { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: { guardian_number: number; trashed_at: string | null; submission_media: { original_path: string; focal_x: number | null; focal_y: number | null } | { original_path: string; focal_x: number | null; focal_y: number | null }[] } | null }> } } } };
  const { data } = await queryClient.from("submissions").select("guardian_number,trashed_at,submission_media(original_path,focal_x,focal_y)").eq("id", id).maybeSingle();
  if (!data?.guardian_number || !data.trashed_at) throw new Error("restore_conflict");
  const media = Array.isArray(data.submission_media) ? data.submission_media[0] : data.submission_media;
  const service = getServiceSupabaseClient();
  const { data: original, error: downloadError } = await service.storage.from(SUBMISSION_ORIGINALS_BUCKET).download(parseStoredOriginalPath(media.original_path));
  if (downloadError || !original) throw new Error("original_missing");
  const variants = await generatePublicVariants(Buffer.from(await original.arrayBuffer()), media.focal_x ?? .5, media.focal_y ?? .5);
  const cardPath = buildPublishedCardPath(data.guardian_number, variants.version);
  const fullPath = buildPublishedFullPath(data.guardian_number, variants.version);
  const uploaded: string[] = [];
  try {
    const card = await service.storage.from(PUBLISHED_IMAGES_BUCKET).upload(cardPath, variants.card.data, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (card.error) throw card.error; uploaded.push(cardPath);
    const full = await service.storage.from(PUBLISHED_IMAGES_BUCKET).upload(fullPath, variants.full.data, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (full.error) throw full.error; uploaded.push(fullPath);
    const { error } = await callUntypedRpc(client, "restore_published_submission", { p_submission_id:id,p_published_version:variants.version,p_card_path:cardPath,p_card_width:variants.card.width,p_card_height:variants.card.height,p_card_bytes:variants.card.bytes,p_full_path:fullPath,p_full_width:variants.full.width,p_full_height:variants.full.height,p_full_bytes:variants.full.bytes });
    if (error) throw new Error(error.message);
  } catch (error) {
    if (uploaded.length) await service.storage.from(PUBLISHED_IMAGES_BUCKET).remove(uploaded);
    throw error;
  }
  revalidateTag(CAMPAIGN_PUBLIC_TAG, "max");
  redirect(`/admin/submissions/${id}?success=restored`);
}

export async function deleteTrashedAction(formData: FormData) {
  await requireRole("admin");
  const input = deletionSchema.parse({ submissionId: formData.get("submissionId"), reason: formData.get("reason"), confirmation: formData.get("confirmation") });
  if (isStaffE2EAdapterEnabled()) redirect("/admin/submissions?status=trashed&testAction=deleted");
  const client = await createServerSupabaseClient();
  const queryClient = client as unknown as { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: { submission_media: { original_path: string; review_thumbnail_path: string | null; published_card_path: string | null; published_full_path: string | null } | { original_path: string; review_thumbnail_path: string | null; published_card_path: string | null; published_full_path: string | null }[]; certificates: { object_path: string | null } | { object_path: string | null }[] } | null }> } } } };
  const { data } = await queryClient.from("submissions").select("submission_media(original_path,review_thumbnail_path,published_card_path,published_full_path),certificates(object_path)").eq("id", input.submissionId).maybeSingle();
  if (!data) throw new Error("delete_requires_trash");
  const media = Array.isArray(data.submission_media) ? data.submission_media[0] : data.submission_media;
  const certificate = Array.isArray(data.certificates) ? data.certificates[0] : data.certificates;
  const service = getServiceSupabaseClient();
  const privatePaths = [
    media?.original_path ? parseStoredOriginalPath(media.original_path) : null,
    media?.review_thumbnail_path ? parseStoredReviewThumbnailPath(media.review_thumbnail_path) : null,
  ].filter((path): path is string => Boolean(path));
  if (privatePaths.length) {
    const result = await service.storage.from(SUBMISSION_ORIGINALS_BUCKET).remove(privatePaths);
    if (result.error) throw new Error("cleanup_required");
  }
  const publicPaths = [media?.published_card_path, media?.published_full_path].filter((path): path is string => Boolean(path));
  if (publicPaths.length) {
    const result = await service.storage.from(PUBLISHED_IMAGES_BUCKET).remove(publicPaths);
    if (result.error) throw new Error("cleanup_required");
  }
  if (certificate?.object_path) {
    const result = await service.storage.from(CERTIFICATES_BUCKET).remove([certificate.object_path]);
    if (result.error) throw new Error("cleanup_required");
  }
  const { error } = await callUntypedRpc(client, "delete_trashed_submission", { p_submission_id: input.submissionId, p_reason: input.reason });
  if (error) throw new Error(error.message);
  revalidateTag(CAMPAIGN_PUBLIC_TAG, "max");
  redirect("/admin/submissions?status=trashed&result=deleted");
}

export async function manageStaffAction(formData: FormData) {
  await requireRole("admin");
  const id = submissionIdSchema.parse(formData.get("staffId"));
  const role = formData.get("role");
  if (role !== "admin" && role !== "reviewer") throw new Error("invalid_staff_profile");
  if (isStaffE2EAdapterEnabled()) redirect("/admin/team?saved=true");
  const client = await createServerSupabaseClient();
  const { error } = await callUntypedRpc(client, "manage_staff_profile", { p_staff_id: id, p_display_name: String(formData.get("displayName") ?? ""), p_role: role, p_active: formData.get("active") === "on" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/team");
  redirect("/admin/team?saved=1");
}

export async function removeStaffAction(formData: FormData) {
  const session = await requireRole("admin");
  const id = submissionIdSchema.parse(formData.get("staffId"));

  if (id === session.userId) throw new Error("self_removal_forbidden");
  if (isStaffE2EAdapterEnabled()) redirect("/admin/team?removed=1");

  const client = await createServerSupabaseClient();
  const { error: prepareError } = await callUntypedRpc(client, "prepare_staff_removal", {
    p_staff_id: id,
  });
  if (prepareError) throw new Error(prepareError.message);

  const service = getServiceSupabaseClient();
  const { error: softDeleteError } = await service.auth.admin.deleteUser(id, true);
  let cleanupErrorCode = softDeleteError?.code ?? null;

  const { error: auditError } = await callUntypedRpc(client, "record_staff_removal", {
    p_staff_id: id,
  });
  if (!auditError) cleanupErrorCode = null;

  if (cleanupErrorCode || auditError) {
    const errorCode = cleanupErrorCode ?? "removal_audit_pending";
    const { error: queueError } = await callUntypedRpc(client, "mark_staff_auth_cleanup_pending", {
      p_staff_id: id,
      p_error_code: errorCode,
    });
    console.error(JSON.stringify({
      level: "error",
      message: "Staff Auth cleanup pending",
      errorCode,
      queueRecorded: !queueError,
    }));
    revalidatePath("/admin/team");
    redirect("/admin/team?removed=1&cleanup=pending");
  }

  revalidatePath("/admin/team");
  redirect("/admin/team?removed=1");
}

export type CreateStaffState = {
  status: "idle" | "invalid" | "error" | "success";
  message: string;
  revision: number;
};

export async function createStaffAction(
  previousState: CreateStaffState,
  formData: FormData,
): Promise<CreateStaffState> {
  await requireRole("admin");
  const parsed = createStaffMemberSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    active: formData.get("active") === "on",
  });

  if (!parsed.success) {
    return {
      status: "invalid",
      message: "Check the name, email, password length, role, and access setting.",
      revision: previousState.revision,
    };
  }

  if (isStaffE2EAdapterEnabled()) {
    return {
      status: "success",
      message: "Team member created.",
      revision: previousState.revision + 1,
    };
  }

  const service = getServiceSupabaseClient();
  const { data: authData, error: authError } = await service.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return {
      status: "error",
      message: "The member could not be created. That email may already be registered.",
      revision: previousState.revision,
    };
  }

  const client = await createServerSupabaseClient();
  const { error: profileError } = await callUntypedRpc(client, "create_staff_profile", {
    p_staff_id: authData.user.id,
    p_display_name: parsed.data.displayName,
    p_role: parsed.data.role,
    p_active: parsed.data.active,
  });

  if (profileError) {
    const { error: rollbackError } = await service.auth.admin.deleteUser(authData.user.id);
    if (rollbackError) {
      console.error("Staff provisioning rollback failed.");
      return {
        status: "error",
        message: "Member setup did not finish. Check Supabase before retrying this email.",
        revision: previousState.revision,
      };
    }
    return {
      status: "error",
      message: "Member setup could not be completed. No account was kept.",
      revision: previousState.revision,
    };
  }

  revalidatePath("/admin/team");
  return {
    status: "success",
    message: "Team member created and ready to sign in.",
    revision: previousState.revision + 1,
  };
}

export async function updateCampaignSettingsAction(formData: FormData) {
  await requireRole("admin");
  const targetCount = Number(formData.get("targetCount"));
  const metricLabel = String(formData.get("metricLabel") ?? "").trim();
  if (!Number.isInteger(targetCount) || targetCount <= 0 || !metricLabel || metricLabel.length > 80) throw new Error("invalid_campaign_settings");
  if (isStaffE2EAdapterEnabled()) redirect("/admin/settings?saved=true");
  const client = await createServerSupabaseClient();
  const { error } = await callUntypedRpc(client, "update_campaign_settings", {
    p_target_count: targetCount,
    p_metric_label: metricLabel,
    p_submissions_open: formData.get("submissionsOpen") === "on",
    p_movement_wall_enabled: formData.get("movementWallEnabled") === "on",
  });
  if (error) throw new Error(error.message);
  updateTag(CAMPAIGN_PUBLIC_TAG);
  revalidatePath("/");
  revalidatePath("/join");
  revalidatePath("/movement");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=true");
}
