import Link from "next/link";
import { notFound } from "next/navigation";

import { regenerateCertificateAction, retryCertificateAction, retryEmailAction } from "@/app/admin/delivery-actions";
import { requireStaff } from "@/lib/auth/dal";
import { getDeliveryCenter, type DeliveryFilters } from "@/lib/deliveries/data.server";

function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—";
}

export default async function DeliveryCenterPage({ searchParams }: { searchParams: Promise<DeliveryFilters & { result?: string }> }) {
  const session = await requireStaff();
  if (session.role !== "admin") notFound();
  const filters = await searchParams;
  const data = await getDeliveryCenter(filters);
  const cards = [
    ["Certificates generated", data.summary.certificate.generated], ["Certificate failures", data.summary.certificate.failed],
    ["Emails sent", data.summary.email.sent], ["Email failures", data.summary.email.failed],
  ] as const;
  return <>
    <header className="admin-page-header"><div><p>Certificate and email operations</p><h1>Delivery Center</h1></div></header>
    {filters.result && <div className="admin-success" role="status">Delivery action completed: {filters.result.replaceAll("_", " ")}.</div>}
    <section className="admin-stat-grid" aria-label="Delivery counts">{cards.map(([label, count]) => <div className="admin-stat-card" key={label}><span>{label}</span><strong>{count}</strong><small>Current state</small></div>)}</section>
    <form className="admin-panel admin-delivery-filters" method="get">
      <label>Delivery kind<select name="kind" defaultValue={filters.kind ?? "all"}><option value="all">All</option><option value="certificate">Certificate</option><option value="submission_received">Submission received</option><option value="approval_certificate">Approval certificate</option><option value="rejection">Rejection</option></select></label>
      <label>Status<select name="status" defaultValue={filters.status ?? "all"}><option value="all">All</option><option value="not_started">Not started</option><option value="queued">Queued</option><option value="generated">Generated</option><option value="sent">Sent</option><option value="failed">Failed</option></select></label>
      <label>Guardian number<input name="guardian" type="number" min="1" defaultValue={filters.guardian} /></label>
      <label>Submitted from<input name="submittedFrom" type="date" defaultValue={filters.submittedFrom} /></label>
      <label>Submitted to<input name="submittedTo" type="date" defaultValue={filters.submittedTo} /></label>
      <label>Generated/sent from<input name="deliveredFrom" type="date" defaultValue={filters.deliveredFrom} /></label>
      <label>Generated/sent to<input name="deliveredTo" type="date" defaultValue={filters.deliveredTo} /></label>
      <button className="button button--primary" type="submit">Apply filters</button>
    </form>
    <section className="admin-panel"><div className="admin-panel__heading"><div><p>Private operations</p><h2>Recent delivery records</h2></div></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Participant</th><th>Delivery</th><th>Status</th><th>Submitted</th><th>Generated / accepted</th><th>Provider event</th><th>Attempts</th><th>Action</th></tr></thead><tbody>
        {data.rows.map((row) => <tr key={`${row.deliveryType}-${row.id}`}><td><Link href={`/admin/submissions/${row.submissionId}`}>{row.displayName ?? "Participant"}</Link><small>{row.guardianNumber ? `Guardian #${row.guardianNumber}` : "No Guardian number"}</small></td><td>{row.kind.replaceAll("_", " ")}</td><td><span className={`status-badge status-badge--${row.status}`}>{row.status.replaceAll("_", " ")}</span>{row.lastErrorCode && <small>{row.lastErrorCode.replaceAll("_", " ")}</small>}</td><td>{dateLabel(row.submittedAt)}</td><td>{dateLabel(row.deliveredAt)}</td><td>{row.providerEvent ? <>{row.providerEvent}<small>{dateLabel(row.providerEventAt)}</small></> : "—"}</td><td>{row.attemptCount}</td><td><div className="admin-delivery-actions">
          {row.deliveryType === "certificate" && row.status === "generated" && <a href={`/api/admin/certificates/${row.id}/download`}>Download</a>}
          {row.deliveryType === "certificate" && ["not_started", "failed"].includes(row.status) && <form action={retryCertificateAction}><input type="hidden" name="submissionId" value={row.submissionId} /><button type="submit">Retry generation</button></form>}
          {row.deliveryType === "certificate" && row.status === "generated" && <form action={regenerateCertificateAction}><input type="hidden" name="submissionId" value={row.submissionId} /><label><span className="sr-only">Type REGENERATE to confirm</span><input name="confirmation" pattern="REGENERATE" placeholder="Type REGENERATE" required /></label><button type="submit">Regenerate</button></form>}
          {row.deliveryType === "email" && ["not_started", "failed"].includes(row.status) && <form action={retryEmailAction}><input type="hidden" name="deliveryId" value={row.id} /><button type="submit">Retry email</button></form>}
        </div></td></tr>)}
      </tbody></table></div>
      {!data.rows.length && <p className="admin-empty">No delivery records match these filters.</p>}
    </section>
  </>;
}
