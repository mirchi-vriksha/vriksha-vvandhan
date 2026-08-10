import "server-only";

import type { CampaignExportData, ExportRecord } from "@/lib/export/campaign-workbook.server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const PAGE_SIZE = 1_000;
const MAX_ROWS_PER_SHEET = 10_000;

type ExportQuery = {
  select: (columns: string) => ExportQuery;
  order: (column: string, options: { ascending: boolean }) => ExportQuery;
  range: (from: number, to: number) => Promise<{ data: ExportRecord[] | null; error: { message: string } | null }>;
};

type ExportClient = { from: (table: string) => ExportQuery };

async function loadTable(client: ExportClient, table: string, columns: string, orderColumn: string): Promise<ExportRecord[]> {
  const records: ExportRecord[] = [];
  for (let from = 0; from < MAX_ROWS_PER_SHEET; from += PAGE_SIZE) {
    const result = await client.from(table).select(columns).order(orderColumn, { ascending: true }).range(from, from + PAGE_SIZE - 1);
    if (result.error) throw new Error(`campaign_export_${table}_failed`);
    const page = result.data ?? [];
    records.push(...page);
    if (page.length < PAGE_SIZE) return records;
  }
  const overflow = await client
    .from(table)
    .select(columns)
    .order(orderColumn, { ascending: true })
    .range(MAX_ROWS_PER_SHEET, MAX_ROWS_PER_SHEET);
  if (overflow.error) throw new Error(`campaign_export_${table}_failed`);
  if ((overflow.data ?? []).length > 0) {
    throw new Error(`campaign_export_${table}_limit_exceeded`);
  }
  return records;
}

export async function loadCampaignExportData(): Promise<CampaignExportData> {
  const client = getServiceSupabaseClient() as unknown as ExportClient;
  const [submissions, contacts, consents, media, certificates, emailDeliveries, audit, settings] = await Promise.all([
    loadTable(client, "submissions", "id,display_name,status,guardian_number,source,is_test,counts_toward_goal,submitted_at,approved_at,published_at,rejected_at,trashed_at,rejection_comment,created_at", "created_at"),
    loadTable(client, "submission_contacts", "submission_id,email", "created_at"),
    loadTable(client, "submission_consents", "submission_id,consent_version,publication_consent,terms_accepted,accepted_at", "created_at"),
    loadTable(client, "submission_media", "submission_id,status,original_mime_type,original_bytes,original_width,original_height,original_checksum_sha256,review_thumbnail_bytes,published_card_path,published_full_path,published_at", "created_at"),
    loadTable(client, "certificates", "submission_id,status,template_version,object_path,file_bytes,attempt_count,generated_at,last_error_code", "created_at"),
    loadTable(client, "email_deliveries", "submission_id,kind,status,attempt_count,queued_at,last_attempt_at,sent_at,delivered_at,bounced_at,complained_at,delivery_delayed_at,provider_failed_at,provider_message_id,last_error_code", "created_at"),
    loadTable(client, "audit_logs", "id,actor_id,action,entity_type,entity_id,reason,created_at", "created_at"),
    loadTable(client, "campaign_settings", "target_count", "created_at"),
  ]);
  return {
    submissions, contacts, consents, media, certificates, emailDeliveries, audit,
    targetCount: Number(settings[0]?.target_count ?? 983),
  };
}
