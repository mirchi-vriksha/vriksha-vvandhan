import "server-only";

import { revalidatePath, updateTag } from "next/cache";

import type { StaffSession } from "@/lib/auth/types";
import { generatePublicVariants } from "@/lib/moderation/publication-image.server";
import { CAMPAIGN_PUBLIC_TAG } from "@/lib/public-campaign/data";
import { PUBLISHED_IMAGES_BUCKET, SUBMISSION_ORIGINALS_BUCKET } from "@/lib/storage/buckets";
import { buildPublishedCardPath, buildPublishedFullPath, parseStoredOriginalPath } from "@/lib/storage/paths";
import { callUntypedRpc } from "@/lib/supabase/rpc.server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

type PublicationRecord = {
  id: string;
  status: string;
  display_name: string | null;
  trashed_at: string | null;
  submission_media: { original_path: string; status: string; focal_x: number | null; focal_y: number | null } | { original_path: string; status: string; focal_x: number | null; focal_y: number | null }[];
};

function mediaOf(record: PublicationRecord) {
  return Array.isArray(record.submission_media) ? record.submission_media[0] : record.submission_media;
}

export async function publishSubmission(client: unknown, session: StaffSession, submissionId: string) {
  const typedClient = client as {
    from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: PublicationRecord | null; error: unknown }> } } };
  };
  const { data: record, error: loadError } = await typedClient.from("submissions")
    .select("id,status,display_name,trashed_at,submission_media(original_path,status,focal_x,focal_y)")
    .eq("id", submissionId).maybeSingle();
  if (loadError || !record || record.trashed_at) throw new Error("already_reviewed");
  if (record.status === "rejection_pending_admin" && session.role !== "admin") throw new Error("unauthorized_role");
  if (!["pending_review", "rejection_pending_admin"].includes(record.status)) throw new Error("already_reviewed");
  const media = mediaOf(record);
  if (!media || media.status !== "uploaded") throw new Error("publication_not_ready");

  const service = getServiceSupabaseClient();
  const { data: reserved, error: reserveError } = await callUntypedRpc<number>(service, "reserve_guardian_number_for_publication", {
    p_submission_id: submissionId, p_actor_id: session.userId,
  });
  if (reserveError || !reserved) throw new Error("approval_conflict");
  const guardianNumber = Number(reserved);
  const { data: original, error: downloadError } = await service.storage.from(SUBMISSION_ORIGINALS_BUCKET).download(parseStoredOriginalPath(media.original_path));
  if (downloadError || !original) throw new Error("original_missing");

  const variants = await generatePublicVariants(Buffer.from(await original.arrayBuffer()), media.focal_x ?? 0.5, media.focal_y ?? 0.5);
  const cardPath = buildPublishedCardPath(guardianNumber, variants.version);
  const fullPath = buildPublishedFullPath(guardianNumber, variants.version);
  const uploaded: string[] = [];
  try {
    const cardUpload = await service.storage.from(PUBLISHED_IMAGES_BUCKET).upload(cardPath, variants.card.data, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (cardUpload.error) throw cardUpload.error;
    uploaded.push(cardPath);
    const fullUpload = await service.storage.from(PUBLISHED_IMAGES_BUCKET).upload(fullPath, variants.full.data, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (fullUpload.error) throw fullUpload.error;
    uploaded.push(fullPath);

    const { data, error } = await callUntypedRpc<unknown[]>(client, "publish_submission", {
      p_submission_id: submissionId, p_guardian_number: guardianNumber,
      p_published_version: variants.version, p_card_path: cardPath,
      p_card_width: variants.card.width, p_card_height: variants.card.height, p_card_bytes: variants.card.bytes,
      p_full_path: fullPath, p_full_width: variants.full.width, p_full_height: variants.full.height, p_full_bytes: variants.full.bytes,
      p_alt_text: `A Vriksha Bandhan promise by ${record.display_name ?? "a Vriksha Guardian"}`,
    });
    if (error || !data) throw new Error("publication_failed");
  } catch (error) {
    if (uploaded.length) await service.storage.from(PUBLISHED_IMAGES_BUCKET).remove(uploaded);
    throw error;
  }
  updateTag(CAMPAIGN_PUBLIC_TAG);
  revalidatePath("/");
  revalidatePath("/movement");
  revalidatePath("/admin");
  revalidatePath(`/admin/submissions/${submissionId}`);
  return guardianNumber;
}
