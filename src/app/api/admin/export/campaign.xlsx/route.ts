import { ForbiddenError, UnauthenticatedError } from "@/lib/auth/errors";
import { requireRole } from "@/lib/auth/dal";
import { buildCampaignWorkbook } from "@/lib/export/campaign-workbook.server";
import { loadCampaignExportData } from "@/lib/export/load-campaign-export.server";
import { consumeRateLimit, EXPORT_RATE_LIMITS } from "@/lib/security/rate-limit.server";
import { callUntypedRpc } from "@/lib/supabase/rpc.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "private, no-store, max-age=0" };

function exportFilename(now: Date): string {
  const stamp = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(now).replace(" ", "-").replace(":", "");
  return `Vriksha-Bandhan-Campaign-Export-${stamp}.xlsx`;
}

export async function GET(): Promise<Response> {
  try {
    const session = await requireRole("admin");
    const allowed = await consumeRateLimit(`staff:${session.userId}`, EXPORT_RATE_LIMITS);
    if (!allowed) {
      return Response.json(
        { error: "rate_limited" },
        { status: 429, headers: { ...noStoreHeaders, "Retry-After": "300" } },
      );
    }
    const exportedAt = new Date();
    const data = await loadCampaignExportData();
    const bytes = await buildCampaignWorkbook(data, { exportedAt, exportedBy: session.displayName });
    const client = await createServerSupabaseClient();
    const audit = await callUntypedRpc(client, "record_campaign_data_export", { p_row_count: data.submissions.length });
    if (audit.error) throw new Error("campaign_export_audit_failed");
    return new Response(Uint8Array.from(bytes), {
      headers: {
        ...noStoreHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exportFilename(exportedAt)}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) return Response.json({ error: "unauthenticated" }, { status: 401, headers: noStoreHeaders });
    if (error instanceof ForbiddenError) return Response.json({ error: "forbidden" }, { status: 403, headers: noStoreHeaders });
    return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers: noStoreHeaders });
  }
}
