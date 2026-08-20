import { updateCampaignSettingsAction } from "@/app/admin/actions";
import { AdminActionButton } from "@/components/admin/admin-action-button";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/dal";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isStaffE2EAdapterEnabled } from "@/lib/testing/staff-adapter";

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const session = await requireStaff();
  if (session.role !== "admin") notFound();
  const result = isStaffE2EAdapterEnabled()
    ? { data:{target_count:983,metric_label:"Vriksha promises",submissions_open:true,movement_wall_enabled:false,updated_at:"2026-08-06T10:00:00.000Z"}, error:null }
    : await (await createServerSupabaseClient()).from("campaign_settings").select("target_count,metric_label,submissions_open,movement_wall_enabled,updated_at").eq("id", 1).single();
  if (result.error) throw new Error("Unable to load campaign settings.");
  const data = result.data;
  const saved = (await searchParams).saved === "true";
  return <>
    <header className="admin-page-header"><div><p>Admin tools</p><h1>Campaign Settings</h1><span>Control public participation, campaign visibility, and operational exports.</span></div></header>
    {saved && <div className="admin-success" role="status">Campaign settings saved.</div>}
    <form className="admin-panel admin-settings" action={updateCampaignSettingsAction}>
      <div><p>Public experience</p><h2>Campaign controls</h2></div>
      <label>Target count<input name="targetCount" type="number" min={1} defaultValue={data.target_count} required /></label>
      <label>Metric label<input name="metricLabel" maxLength={80} defaultValue={data.metric_label} required /></label>
      <label className="team-card__active"><input name="submissionsOpen" type="checkbox" defaultChecked={data.submissions_open} /> Public submissions are open</label>
      <label className="team-card__active"><input name="movementWallEnabled" type="checkbox" defaultChecked={data.movement_wall_enabled} /> Display the public Movement Wall</label>
      <small>When disabled, the Movement Wall link and page are removed publicly. Published records, images, Guardian numbers, and the campaign count remain unchanged.</small>
      <small>Last changed {new Date(data.updated_at).toLocaleString("en-IN")}. Changes are audited and invalidate public campaign data.</small>
      <AdminActionButton className="button button--primary" label="Save campaign controls" pendingLabel="Saving campaign controls…" />
    </form>
    <section className="admin-panel admin-settings" aria-labelledby="delivery-configuration-title">
      <div><p>Operational health</p><h2 id="delivery-configuration-title">Delivery configuration</h2></div>
      <dl className="admin-settings-status">
        <div><dt>Certificate template</dt><dd>Installed · vriksha-bandhan-2026-v2</dd></div>
        <div><dt>Email sending</dt><dd>{process.env.EMAIL_SENDING_ENABLED === "true" ? "Enabled" : "Disabled (safe default)"}</dd></div>
        <div><dt>Staging recipient guard</dt><dd>{process.env.EMAIL_TEST_RECIPIENT ? "Configured" : "Not configured"}</dd></div>
      </dl>
      <small>No API keys or participant addresses are displayed here.</small>
    </section>
    <section className="admin-panel admin-settings" aria-labelledby="data-export-title">
      <div><p>Sensitive Admin operation</p><h2 id="data-export-title">Campaign data export</h2></div>
      <p>Download the operational campaign workbook. It contains participant contact details and must be handled as sensitive data.</p>
      <a className="button button--primary" href="/api/admin/export/campaign.xlsx">Export Campaign Data</a>
      <small>Every successful export is recorded in the audit log. Secrets, signed URLs, request tokens, and binary files are excluded.</small>
    </section>
  </>;
}
