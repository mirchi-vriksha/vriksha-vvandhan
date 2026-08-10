import "server-only";

import { callUntypedRpc } from "@/lib/supabase/rpc.server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { SUBMISSION_ORIGINALS_BUCKET } from "@/lib/storage/buckets";

type ExpiredDraft = {
  id: string;
  submission_media:
    | { original_path: string }[]
    | { original_path: string }
    | null;
};

export type DraftCleanupResult = {
  inspected: number;
  deleted: number;
  storageObjectsRemoved: number;
  failed: number;
  rateLimitBucketsPurged: number;
};

export async function cleanupExpiredDrafts(batchSize = 50): Promise<DraftCleanupResult> {
  const limit = Math.min(Math.max(Math.trunc(batchSize), 1), 100);
  const service = getServiceSupabaseClient();
  const now = new Date().toISOString();
  const query = await service
    .from("submissions")
    .select("id,submission_media(original_path)")
    .eq("status", "draft")
    .lt("draft_expires_at", now)
    .order("draft_expires_at", { ascending: true })
    .limit(limit);
  if (query.error) throw new Error("expired_draft_lookup_failed");

  const result: DraftCleanupResult = {
    inspected: query.data?.length ?? 0,
    deleted: 0,
    storageObjectsRemoved: 0,
    failed: 0,
    rateLimitBucketsPurged: 0,
  };

  for (const value of query.data ?? []) {
    const draft = value as unknown as ExpiredDraft;
    const media = Array.isArray(draft.submission_media)
      ? draft.submission_media[0]
      : draft.submission_media;
    const objectPath = media?.original_path ?? `${draft.id}/original.webp`;

    const slash = objectPath.lastIndexOf("/");
    const folder = objectPath.slice(0, slash);
    const filename = objectPath.slice(slash + 1);
    const listed = await service.storage
      .from(SUBMISSION_ORIGINALS_BUCKET)
      .list(folder, { search: filename, limit: 2 });
    if (listed.error) {
      result.failed += 1;
      continue;
    }

    if (listed.data.some((object) => object.name === filename)) {
      const removed = await service.storage
        .from(SUBMISSION_ORIGINALS_BUCKET)
        .remove([objectPath]);
      if (removed.error) {
        result.failed += 1;
        continue;
      }
      result.storageObjectsRemoved += 1;
    }

    const deleted = await service
      .from("submissions")
      .delete()
      .eq("id", draft.id)
      .eq("status", "draft")
      .lt("draft_expires_at", now)
      .select("id");
    if (deleted.error) {
      result.failed += 1;
      continue;
    }
    result.deleted += deleted.data?.length ?? 0;
  }

  const purge = await callUntypedRpc<number>(service, "purge_expired_rate_limits", {
    p_limit: 1_000,
  });
  if (!purge.error && typeof purge.data === "number") {
    result.rateLimitBucketsPurged = purge.data;
  }
  return result;
}
