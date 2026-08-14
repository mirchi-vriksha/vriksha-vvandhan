import Link from "next/link";
import { notFound } from "next/navigation";

import { regenerateCertificateAction, retryCertificateAction, retryEmailAction } from "@/app/admin/delivery-actions";
import { requireStaff } from "@/lib/auth/dal";
import { getDeliveryCenter, type DeliveryFilters, type DeliveryRow } from "@/lib/deliveries/data.server";

function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—";
}

function DeliveryAction({ row }: { row: DeliveryRow }) {
  return <div className="admin-delivery-actions">
    {row.deliveryType === "certificate" && row.status === "generated" && <a href={`/api/admin/certificates/${row.id}/download`}>Download</a>}
    {row.deliveryType === "certificate" && ["not_started", "failed"].includes(row.status) && <form action={retryCertificateAction}><input type="hidden" name="submissionId" value={row.submissionId} /><button type="submit">Retry generation</button></form>}
    {row.deliveryType === "certificate" && row.status === "generated" && <form action={regenerateCertificateAction}><input type="hidden" name="submissionId" value={row.submissionId} /><label><span className="sr-only">Type REGENERATE to confirm</span><input name="confirmation" pattern="REGENERATE" placeholder="Type REGENERATE" required /></label><button type="submit">Regenerate</button></form>}
    {row.deliveryType === "email" && ["not_started", "failed"].includes(row.status) && <form action={retryEmailAction}><input type="hidden" name="deliveryId" value={row.id} /><button type="submit">Retry email</button></form>}
  </div>;
}

export default async function DeliveryCenterPage({ searchParams }: { searchParams: Promise<DeliveryFilters & { result?: string }> }) {
  const session = await requireStaff();
  if (session.role !== "admin") notFound();
  const query = await searchParams;
  const hasFilters = [query.kind, query.status, query.guardian, query.submittedFrom, query.submittedTo, query.deliveredFrom, query.deliveredTo].some(Boolean);
  const filters: DeliveryFilters = hasFilters ? query : { status: "failed" };
  const data = await getDeliveryCenter(filters);
  const cards = [
    ["Certificate failures", data.summary.certificate.failed, "failed"],
    ["Email failures", data.summary.email.failed, "failed"],
    ["Certificates ready", data.summary.certificate.generated, "healthy"],
    ["Emails sent", data.summary.email.sent, "healthy"],
  ] as const;
  return <>
    <header className="admin-page-header"><div><p>Admin tools</p><h1>Deliveries</h1><span>Resolve failed certificates and emails first, then inspect delivery history.</span></div></header>
    {query.result && <div className="admin-success" role="status">Delivery action completed: {query.result.replaceAll("_", " ")}.</div>}
    <section className="admin-delivery-summary" aria-label="Delivery counts">{cards.map(([label, count, tone]) => <div className={`admin-stat-card admin-stat-card--${tone}`} key={label}><span>{label}</span><strong>{count}</strong></div>)}</section>

    <form className="admin-panel admin-delivery-filters" method="get">
      <label>Delivery kind<select name="kind" defaultValue={filters.kind ?? "all"}><option value="all">All deliveries</option><option value="certificate">Certificate</option><option value="submission_received">Submission received</option><option value="approval_certificate">Approval certificate</option><option value="rejection">Rejection</option></select></label>
      <label>Status<select name="status" defaultValue={filters.status ?? "all"}><option value="all">All statuses</option><option value="not_started">Not started</option><option value="queued">Queued</option><option value="generated">Generated</option><option value="sent">Sent</option><option value="failed">Needs attention</option></select></label>
      <button className="button button--primary" type="submit">Apply filters</button>
      <Link className="button button--light" href="/admin/deliveries?kind=all&status=all">View all records</Link>
      <details className="admin-advanced-filters"><summary>Advanced filters</summary><div>
        <label>Guardian number<input name="guardian" type="number" min="1" defaultValue={filters.guardian} /></label>
        <label>Submitted from<input name="submittedFrom" type="date" defaultValue={filters.submittedFrom} /></label>
        <label>Submitted to<input name="submittedTo" type="date" defaultValue={filters.submittedTo} /></label>
        <label>Generated/sent from<input name="deliveredFrom" type="date" defaultValue={filters.deliveredFrom} /></label>
        <label>Generated/sent to<input name="deliveredTo" type="date" defaultValue={filters.deliveredTo} /></label>
      </div></details>
    </form>

    <section className="admin-panel admin-delivery-panel"><div className="admin-panel__heading"><div><p>{filters.status === "failed" ? "Needs attention" : "Private operations"}</p><h2>{filters.status === "failed" ? "Failed delivery records" : "Delivery records"}</h2></div></div>
      {data.rows.length ? <div className="admin-delivery-list"><div className="admin-delivery-list__header" aria-hidden="true"><span>Participant</span><span>Delivery</span><span>Status</span><span>Timeline</span><span>Action</span></div><ul>{data.rows.map((row) => <li key={`${row.deliveryType}-${row.id}`}>
        <div><Link href={`/admin/submissions/${row.submissionId}`}>{row.displayName ?? "Participant"}</Link><small>{row.guardianNumber ? `Guardian #${row.guardianNumber}` : "No Guardian number"}</small></div>
        <div><span className="admin-delivery-mobile-label">Delivery</span><strong>{row.kind.replaceAll("_", " ")}</strong></div>
        <div><span className={`status-badge status-badge--${row.status}`}>{row.status.replaceAll("_", " ")}</span>{row.lastErrorCode && <small>{row.lastErrorCode.replaceAll("_", " ")}</small>}</div>
        <div><span className="admin-delivery-mobile-label">Timeline</span><small>Submitted {dateLabel(row.submittedAt)}</small><small>{row.deliveredAt ? `Completed ${dateLabel(row.deliveredAt)}` : `${row.attemptCount} attempt${row.attemptCount === 1 ? "" : "s"}`}</small>{row.providerEvent && <small>{row.providerEvent} · {dateLabel(row.providerEventAt)}</small>}</div>
        <DeliveryAction row={row} />
      </li>)}</ul></div> : <p className="admin-empty">No delivery records match these filters.</p>}
    </section>
  </>;
}
