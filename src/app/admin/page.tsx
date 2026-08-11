import Link from "next/link";

import { AdminRefreshControls } from "@/components/admin/admin-refresh-controls";
import { requireStaff } from "@/lib/auth/dal";
import { getOldestUnreviewedAgeHours, getSubmissionCounts, listSubmissions } from "@/lib/moderation/data.server";

export default async function AdminOverviewPage() {
  const session = await requireStaff();
  const [counts, latest, oldestAgeHours] = await Promise.all([getSubmissionCounts(), listSubmissions("pending_review", ""), getOldestUnreviewedAgeHours()]);
  const cards: Array<readonly [string, number, string]> = [
    ["Pending Review", counts.pending_review, "/admin/submissions?status=pending_review"],
    ["Rejection Awaiting Admin", counts.rejection_pending_admin, "/admin/submissions?status=rejection_pending_admin"],
    ["Published", counts.published, "/admin/submissions?status=published"],
    ["Rejected", counts.rejected, "/admin/submissions?status=rejected"],
  ];
  if (session.role === "admin") cards.push(["Trashed", counts.trashed, "/admin/submissions?status=trashed"]);
  if (session.role === "admin") {
    cards.push(["Certificates Generated", counts.certificate_generated, "/admin/deliveries?kind=certificate&status=generated"]);
    cards.push(["Approval Emails Sent", counts.approval_email_sent, "/admin/deliveries?kind=approval_certificate&status=sent"]);
    cards.push(["Rejection Emails Sent", counts.rejection_email_sent, "/admin/deliveries?kind=rejection&status=sent"]);
    cards.push(["Failed Deliveries", counts.certificate_failed + counts.email_failed, "/admin/deliveries?status=failed"]);
  }
  return <>
    <header className="admin-page-header"><div><p>Vriksha Bandhan operations</p><h1>Overview</h1></div><AdminRefreshControls refreshedAt={new Date().toISOString()} /></header>
    <section className="admin-stat-grid" aria-label="Submission counts">{cards.map(([label,count,href]) => <Link href={href} key={label}><span>{label}</span><strong>{count}</strong><small>Open queue</small></Link>)}</section>
    <p className="admin-intro">Oldest unreviewed: {oldestAgeHours === null ? "None" : `${oldestAgeHours} hours`}</p>
    <section className="admin-panel"><div className="admin-panel__heading"><div><p>Review next</p><h2>Latest pending submissions</h2></div><Link href="/admin/submissions?status=pending_review">View queue</Link></div>
      {latest.length ? <ul className="admin-compact-list">{latest.slice(0, 6).map(item => <li key={item.id}><div><strong>{item.display_name}</strong><span>{item.submitted_at ? new Date(item.submitted_at).toLocaleString("en-IN") : "Awaiting timestamp"}</span></div><Link href={`/admin/submissions/${item.id}`}>Review</Link></li>)}</ul> : <p className="admin-empty">Nothing is waiting for review.</p>}
    </section>
  </>;
}
