import Link from "next/link";

import { AdminRefreshControls } from "@/components/admin/admin-refresh-controls";
import { requireStaff } from "@/lib/auth/dal";
import { getOldestUnreviewedAgeHours, getSubmissionCounts, listSubmissions } from "@/lib/moderation/data.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isStaffE2EAdapterEnabled } from "@/lib/testing/staff-adapter";

async function getCampaignHealth() {
  if (isStaffE2EAdapterEnabled()) return { target_count: 983, submissions_open: true, movement_wall_enabled: false };
  const { data } = await (await createServerSupabaseClient())
    .from("campaign_settings")
    .select("target_count,submissions_open,movement_wall_enabled")
    .eq("id", 1)
    .maybeSingle();
  return data;
}

function ageLabel(hours: number | null) {
  if (hours === null) return "Queue clear";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export default async function AdminOverviewPage() {
  const session = await requireStaff();
  const [counts, latest, oldestAgeHours, campaign] = await Promise.all([
    getSubmissionCounts(),
    listSubmissions("pending_review", ""),
    getOldestUnreviewedAgeHours(),
    getCampaignHealth(),
  ]);
  const failedDeliveries = counts.certificate_failed + counts.email_failed;
  const attentionCards = [
    { label: "Pending reviews", value: counts.pending_review, note: counts.pending_review === 1 ? "promise needs a decision" : "promises need a decision", href: "/admin/submissions?status=pending_review", tone: "primary" },
    ...(session.role === "admin" ? [{ label: "Rejections awaiting you", value: counts.rejection_pending_admin, note: "need a final Admin decision", href: "/admin/submissions?status=rejection_pending_admin", tone: "warning" }] : []),
    ...(session.role === "admin" ? [{ label: "Failed deliveries", value: failedDeliveries, note: "certificate or email retries", href: "/admin/deliveries?status=failed", tone: "danger" }] : []),
    { label: "Oldest waiting", value: ageLabel(oldestAgeHours), note: oldestAgeHours === null ? "nothing is waiting" : "since submission", href: "/admin/submissions?status=pending_review", tone: "neutral" },
  ];
  return <>
    <header className="admin-page-header">
      <div><p>Today in the Campaign Desk</p><h1>Needs attention</h1><span>Start with the work that is waiting on your team.</span></div>
      <AdminRefreshControls refreshedAt={new Date().toISOString()} />
    </header>

    <section className="admin-attention-grid" aria-label="Work needing attention">
      {attentionCards.map((card) => <Link className={`admin-attention-card admin-attention-card--${card.tone}`} href={card.href} key={card.label}>
        <span>{card.label}</span><strong>{card.value}</strong><small>{card.note}</small>
      </Link>)}
    </section>

    <div className="admin-dashboard-grid">
      <section className="admin-panel admin-next-review">
        <div className="admin-panel__heading"><div><p>Review next</p><h2>Pending promises</h2></div><Link href="/admin/submissions?status=pending_review">Open full queue</Link></div>
        {latest.length ? <>
          <Link className="button button--primary admin-review-next" href={`/admin/submissions/${latest[0].id}`}>Review next submission</Link>
          <ul className="admin-compact-list">{latest.slice(0, 5).map((item, index) => <li key={item.id}>
            <div><strong>{item.display_name}</strong><span>{index === 0 ? "Next in queue" : item.submitted_at ? new Date(item.submitted_at).toLocaleString("en-IN") : "Awaiting timestamp"}</span></div>
            <Link href={`/admin/submissions/${item.id}`}>Review</Link>
          </li>)}</ul>
        </> : <p className="admin-empty">Nothing is waiting for review.</p>}
      </section>

      <aside className="admin-panel admin-campaign-health" aria-labelledby="campaign-health-title">
        <div><p>Campaign health</p><h2 id="campaign-health-title">Live controls</h2></div>
        <dl>
          <div><dt>Published promises</dt><dd>{counts.published} / {campaign?.target_count ?? "—"}</dd></div>
          <div><dt>Public submissions</dt><dd><span className={`admin-health-dot ${campaign?.submissions_open ? "is-on" : ""}`} />{campaign?.submissions_open ? "Open" : "Closed"}</dd></div>
          <div><dt>Movement Wall</dt><dd><span className={`admin-health-dot ${campaign?.movement_wall_enabled ? "is-on" : ""}`} />{campaign?.movement_wall_enabled ? "Visible" : "Hidden"}</dd></div>
          {session.role === "admin" && <div><dt>Delivery sending</dt><dd><span className={`admin-health-dot ${process.env.EMAIL_SENDING_ENABLED === "true" ? "is-on" : ""}`} />{process.env.EMAIL_SENDING_ENABLED === "true" ? "Enabled" : "Disabled"}</dd></div>}
        </dl>
        {session.role === "admin" && <Link href="/admin/settings">Manage campaign settings</Link>}
      </aside>
    </div>
  </>;
}
