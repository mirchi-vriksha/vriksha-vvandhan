import "server-only";

import { requireRole } from "@/lib/auth/dal";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isStaffE2EAdapterEnabled } from "@/lib/testing/staff-adapter";

export type DeliveryFilters = {
  kind?: string;
  status?: string;
  guardian?: string;
  submittedFrom?: string;
  submittedTo?: string;
  deliveredFrom?: string;
  deliveredTo?: string;
};

export type DeliveryRow = {
  id: string;
  submissionId: string;
  deliveryType: "certificate" | "email";
  kind: string;
  status: string;
  guardianNumber: number | null;
  displayName: string | null;
  submittedAt: string | null;
  deliveredAt: string | null;
  providerEventAt: string | null;
  providerEvent: string | null;
  attemptCount: number;
  lastErrorCode: string | null;
  objectPath: string | null;
};

type QueryResult = { data: unknown[] | null; error: { message: string } | null };
type DeliveryQuery = {
  eq: (column: string, value: string | number) => DeliveryQuery;
  gte: (column: string, value: string) => DeliveryQuery;
  lte: (column: string, value: string) => DeliveryQuery;
  order: (column: string, options: { ascending: boolean }) => DeliveryQuery;
  limit: (limit: number) => Promise<QueryResult>;
};
type DeliveryClient = { from: (table: string) => { select: (columns: string) => DeliveryQuery } };

function validDate(value: string | undefined): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function applyFilters(query: DeliveryQuery, filters: DeliveryFilters, type: "certificate" | "email") {
  const guardian = Number(filters.guardian);
  if (Number.isSafeInteger(guardian) && guardian > 0) query = query.eq("submissions.guardian_number", guardian);
  const submittedFrom = validDate(filters.submittedFrom);
  const submittedTo = validDate(filters.submittedTo);
  const deliveredFrom = validDate(filters.deliveredFrom);
  const deliveredTo = validDate(filters.deliveredTo);
  if (submittedFrom) query = query.gte("submissions.submitted_at", `${submittedFrom}T00:00:00.000Z`);
  if (submittedTo) query = query.lte("submissions.submitted_at", `${submittedTo}T23:59:59.999Z`);
  const deliveryColumn = type === "certificate" ? "generated_at" : "sent_at";
  if (deliveredFrom) query = query.gte(deliveryColumn, `${deliveredFrom}T00:00:00.000Z`);
  if (deliveredTo) query = query.lte(deliveryColumn, `${deliveredTo}T23:59:59.999Z`);
  return query;
}

function submissionOf(value: unknown): Record<string, unknown> {
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved && typeof resolved === "object" ? resolved as Record<string, unknown> : {};
}

export async function getDeliveryCenter(filters: DeliveryFilters) {
  await requireRole("admin");
  if (isStaffE2EAdapterEnabled()) {
    return {
      summary: { certificate: { not_started: 1, queued: 0, generated: 1, failed: 1 }, email: { not_started: 1, queued: 0, sent: 1, failed: 1 } },
      rows: [
        { id: "c1000000-0000-4000-8000-000000000001", submissionId: "e1000000-0000-4000-8000-000000000001", deliveryType: "certificate", kind: "certificate", status: "generated", guardianNumber: 42, displayName: "Asha Test", submittedAt: "2026-08-06T10:00:00.000Z", deliveredAt: "2026-08-06T11:00:00.000Z", providerEventAt: null, providerEvent: null, attemptCount: 1, lastErrorCode: null, objectPath: "e1000000-0000-4000-8000-000000000001/vriksha-guardian-42-v1.pdf" },
        { id: "d1000000-0000-4000-8000-000000000001", submissionId: "e1000000-0000-4000-8000-000000000001", deliveryType: "email", kind: "approval_certificate", status: "failed", guardianNumber: 42, displayName: "Asha Test", submittedAt: "2026-08-06T10:00:00.000Z", deliveredAt: null, providerEventAt: null, providerEvent: null, attemptCount: 1, lastErrorCode: "resend_provider_error", objectPath: null },
      ] as DeliveryRow[],
    };
  }

  const client = await createServerSupabaseClient();
  const counts = await Promise.all((["not_started", "queued", "generated", "failed"] as const).map(async (status) => {
    const result = await client.from("certificates").select("id", { count: "exact", head: true }).eq("status", status);
    return [status, result.count ?? 0] as const;
  }));
  const emailCounts = await Promise.all((["not_started", "queued", "sent", "failed"] as const).map(async (status) => {
    const result = await client.from("email_deliveries").select("id", { count: "exact", head: true }).eq("status", status);
    return [status, result.count ?? 0] as const;
  }));

  const queryClient = client as unknown as DeliveryClient;
  const includeCertificates = !filters.kind || filters.kind === "all" || filters.kind === "certificate";
  const includeEmails = !filters.kind || filters.kind === "all" || ["submission_received", "approval_certificate", "rejection"].includes(filters.kind);
  const requests: Promise<QueryResult>[] = [];
  if (includeCertificates) {
    let query = queryClient.from("certificates").select("id,submission_id,status,attempt_count,generated_at,last_error_code,object_path,submissions!inner(display_name,guardian_number,submitted_at)");
    if (["not_started", "queued", "generated", "failed"].includes(filters.status ?? "")) query = query.eq("status", filters.status!);
    query = applyFilters(query, filters, "certificate");
    requests.push(query.order("updated_at", { ascending: false }).limit(100));
  } else requests.push(Promise.resolve({ data: [], error: null }));
  if (includeEmails) {
    let query = queryClient.from("email_deliveries").select("id,submission_id,kind,status,attempt_count,sent_at,delivered_at,bounced_at,complained_at,delivery_delayed_at,provider_failed_at,last_error_code,submissions!inner(display_name,guardian_number,submitted_at)");
    if (["not_started", "queued", "sent", "failed"].includes(filters.status ?? "")) query = query.eq("status", filters.status!);
    if (filters.kind && filters.kind !== "all") query = query.eq("kind", filters.kind);
    query = applyFilters(query, filters, "email");
    requests.push(query.order("updated_at", { ascending: false }).limit(100));
  } else requests.push(Promise.resolve({ data: [], error: null }));
  const [certificateResult, emailResult] = await Promise.all(requests);
  if (certificateResult.error || emailResult.error) throw new Error("delivery_center_unavailable");

  const certificateRows = (certificateResult.data ?? []).map((value) => {
    const row = value as Record<string, unknown>;
    const submission = submissionOf(row.submissions);
    return { id:String(row.id),submissionId:String(row.submission_id),deliveryType:"certificate" as const,kind:"certificate",status:String(row.status),guardianNumber:Number(submission.guardian_number)||null,displayName:typeof submission.display_name === "string" ? submission.display_name : null,submittedAt:typeof submission.submitted_at === "string" ? submission.submitted_at : null,deliveredAt:typeof row.generated_at === "string" ? row.generated_at : null,providerEventAt:null,providerEvent:null,attemptCount:Number(row.attempt_count)||0,lastErrorCode:typeof row.last_error_code === "string" ? row.last_error_code : null,objectPath:typeof row.object_path === "string" ? row.object_path : null };
  });
  const emailRows = (emailResult.data ?? []).map((value) => {
    const row = value as Record<string, unknown>;
    const submission = submissionOf(row.submissions);
    const events = [
      ["complained", row.complained_at],
      ["bounced", row.bounced_at],
      ["provider failed", row.provider_failed_at],
      ["delivered", row.delivered_at],
      ["delivery delayed", row.delivery_delayed_at],
    ] as const;
    const providerEvent = events.find(([, value]) => typeof value === "string") ?? null;
    return { id:String(row.id),submissionId:String(row.submission_id),deliveryType:"email" as const,kind:String(row.kind),status:String(row.status),guardianNumber:Number(submission.guardian_number)||null,displayName:typeof submission.display_name === "string" ? submission.display_name : null,submittedAt:typeof submission.submitted_at === "string" ? submission.submitted_at : null,deliveredAt:typeof row.sent_at === "string" ? row.sent_at : null,providerEventAt:providerEvent && typeof providerEvent[1] === "string" ? providerEvent[1] : null,providerEvent:providerEvent?.[0] ?? null,attemptCount:Number(row.attempt_count)||0,lastErrorCode:typeof row.last_error_code === "string" ? row.last_error_code : null,objectPath:null };
  });
  return {
    summary: { certificate: Object.fromEntries(counts), email: Object.fromEntries(emailCounts) },
    rows: [...certificateRows, ...emailRows].sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "")),
  };
}
