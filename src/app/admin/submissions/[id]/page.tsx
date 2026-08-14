/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";

import { approveSubmissionAction, confirmRejectionAction, deleteTrashedAction, recommendRejectionAction, restoreNonpublishedAction, restorePublishedAction, trashSubmissionAction } from "@/app/admin/actions";
import { FocalPointEditor } from "@/components/admin/focal-point-editor";
import { getSubmissionDetail } from "@/lib/moderation/data.server";

type DetailRecord = {
  id: string; status: string; display_name: string | null; submitted_at: string | null; guardian_number: number | null;
  rejection_comment: string | null; rejection_recommended_at: string | null; rejected_at: string | null; trashed_at: string | null;
  submission_consents: { publication_consent: boolean; terms_accepted: boolean; accepted_at: string } | { publication_consent: boolean; terms_accepted: boolean; accepted_at: string }[];
  submission_media: { status: string; original_mime_type: string | null; original_bytes: number | null; original_width: number | null; original_height: number | null; review_thumbnail_width: number | null; review_thumbnail_height: number | null; review_thumbnail_bytes: number | null; focal_x: number | null; focal_y: number | null } | { status: string; original_mime_type: string | null; original_bytes: number | null; original_width: number | null; original_height: number | null; review_thumbnail_width: number | null; review_thumbnail_height: number | null; review_thumbnail_bytes: number | null; focal_x: number | null; focal_y: number | null }[];
  certificates: { id: string; status: string; template_version: string | null; generated_at: string | null; last_error_code: string | null } | { id: string; status: string; template_version: string | null; generated_at: string | null; last_error_code: string | null }[];
  email_deliveries: { id: string; kind: string; status: string; sent_at: string | null; last_error_code: string | null }[];
};

function one<T>(value: T | T[]): T { return Array.isArray(value) ? value[0] : value; }

export default async function SubmissionDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; cleanup?: string; testAction?: string }> }) {
  const { id } = await params;
  const result = await getSubmissionDetail(id);
  if (!result) notFound();
  const record = result.record as unknown as DetailRecord;
  const media = one(record.submission_media);
  const consent = one(record.submission_consents);
  const certificate = one(record.certificates);
  const query = await searchParams;
  const successMessage = query.success === "published"
    ? `Published successfully. Guardian #${record.guardian_number} has been assigned.`
    : query.success === "rejection-recommended"
      ? "Rejection recommendation saved and sent to an Admin for the final decision."
      : query.success === "rejected" ? "Submission rejected successfully." : null;
  const reviewable = ["pending_review", "rejection_pending_admin"].includes(record.status) && !record.trashed_at;
  const canApprove = reviewable && (record.status === "pending_review" || result.session.role === "admin");
  const queueStatus = record.trashed_at ? "trashed" : record.status;

  const decisionPanel = reviewable ? <section className="admin-panel admin-actions admin-decision-panel" aria-labelledby="moderation-decision-title">
    <div><p>Decision</p><h2 id="moderation-decision-title">Moderation</h2></div>
    {canApprove && <form action={approveSubmissionAction}><input type="hidden" name="submissionId" value={record.id} /><button className="button button--primary" type="submit">Approve and publish</button><small>This publishes the promise and assigns its Guardian number.</small></form>}
    {result.session.role === "reviewer" && record.status === "pending_review" && <form action={recommendRejectionAction}><input type="hidden" name="submissionId" value={record.id} /><label>Participant-facing recommendation comment<textarea name="comment" minLength={10} maxLength={1200} required /></label><button className="button button--light" type="submit">Recommend Rejection</button><small>An Admin makes the final decision. No email is sent yet.</small></form>}
    {result.session.role === "reviewer" && record.status === "rejection_pending_admin" && <p className="admin-notice">This recommendation is waiting for an Admin decision.</p>}
    {result.session.role === "admin" && <form action={confirmRejectionAction}><input type="hidden" name="submissionId" value={record.id} /><label>Participant-facing rejection comment<textarea name="comment" defaultValue={record.rejection_comment ?? ""} minLength={10} maxLength={1200} required /></label><button className="button button--light" type="submit">{record.status === "rejection_pending_admin" ? "Confirm Rejection" : "Reject submission"}</button><small>Final rejection queues the participant notification.</small></form>}
  </section> : null;

  return <>
    <Link className="admin-back-link" href={`/admin/submissions?status=${queueStatus}`}>← Back to Review Queue</Link>
    <header className="admin-page-header admin-submission-header"><div><p>Submission detail</p><h1>{record.display_name ?? "Participant submission"}</h1><span>Review the photo, adjust the public card, then make a decision.</span></div><span className={`status-badge status-badge--${record.status}`}>{record.status.replaceAll("_", " ")}</span></header>
    {successMessage && <div className="admin-success" role="status">{successMessage}</div>}
    {query.testAction && <div className="admin-success" role="status">Test moderation action completed: {query.testAction.replaceAll("-", " ")}.</div>}
    {query.cleanup === "required" && <div className="admin-notice" role="alert">The record is safely hidden, but its public image cleanup needs an Admin retry before permanent deletion.</div>}

    <div className={`admin-review-workspace${reviewable ? "" : " admin-review-workspace--single"}`}>
      {reviewable && result.reviewImage ? <section className="admin-panel admin-public-card-editor"><div><p>Public presentation</p><h2>Adjust public card</h2><span>Confirm the name and choose the strongest crop before deciding.</span></div><FocalPointEditor submissionId={record.id} displayName={record.display_name ?? ""} imageUrl={result.reviewImage.signedUrl} previewUrl={result.reviewThumbnail?.signedUrl} initialX={media?.focal_x ?? .5} initialY={media?.focal_y ?? .5} /></section>
        : <section className="admin-panel admin-review-image"><div><p>Private photograph</p><h2>Submission preview</h2></div>{result.reviewThumbnail ? <><img src={result.reviewThumbnail.signedUrl} alt="Private submitted photograph preview" width="240" height="300" loading="eager" decoding="async" /><small>Private preview · signed for 10 minutes</small></> : <p>Private preview is temporarily unavailable.</p>}</section>}
      {decisionPanel}
    </div>

    <details className="admin-panel admin-disclosure" open>
      <summary><span><small>Reference</small><strong>Submission details</strong></span><span aria-hidden="true">+</span></summary>
      <dl className="admin-facts"><div><dt>Status</dt><dd>{record.status.replaceAll("_", " ")}</dd></div><div><dt>Submitted</dt><dd>{record.submitted_at ? new Date(record.submitted_at).toLocaleString("en-IN") : "—"}</dd></div><div><dt>Guardian number</dt><dd>{record.guardian_number ? `#${record.guardian_number}` : "Not assigned"}</dd></div><div><dt>Publication consent</dt><dd>{consent?.publication_consent ? "Confirmed" : "Missing"}</dd></div><div><dt>Terms accepted</dt><dd>{consent?.terms_accepted ? "Confirmed" : "Missing"}</dd></div><div><dt>Image</dt><dd>{media?.original_width ?? "—"} × {media?.original_height ?? "—"} · {media?.original_mime_type ?? "unknown"} · {media?.original_bytes ? `${Math.round(media.original_bytes / 1024)} KB` : "—"}</dd></div>{result.session.role === "admin" && <div><dt>Participant email</dt><dd>{result.email ?? "Unavailable"}</dd></div>}<div><dt>Certificate</dt><dd>{certificate?.status?.replaceAll("_", " ") ?? "Not started"}</dd></div></dl>
      {record.email_deliveries?.length > 0 && <div className="admin-deliveries"><h3>Participant notifications</h3>{record.email_deliveries.map(item => <p key={item.kind}>{item.kind.replaceAll("_", " ")}: <strong>{item.status.replaceAll("_", " ")}</strong>{item.sent_at ? ` · ${new Date(item.sent_at).toLocaleString("en-IN")}` : ""}</p>)}</div>}
      {result.session.role === "admin" && <p><Link href="/admin/deliveries?status=failed">Manage certificate and email deliveries</Link></p>}
    </details>

    {result.session.role === "admin" && <details className="admin-panel admin-disclosure admin-danger"><summary><span><small>Admin only</small><strong>Trash and deletion</strong></span><span aria-hidden="true">+</span></summary>{!record.trashed_at ? <form action={trashSubmissionAction}><input type="hidden" name="submissionId" value={record.id} /><p>Trash hides this record from public results immediately. Published Guardian numbers remain reserved.</p><label className="team-card__active"><input type="checkbox" required /> I understand the public visibility and count may change.</label><button className="button button--light" type="submit">Move to Trash</button></form> : <>{record.status === "published" ? <form action={restorePublishedAction}><input type="hidden" name="submissionId" value={record.id} /><p>New immutable public variants will be generated before visibility returns.</p><button className="button button--light" type="submit">Regenerate and restore publication</button></form> : <form action={restoreNonpublishedAction}><input type="hidden" name="submissionId" value={record.id} /><button className="button button--light" type="submit">Restore record</button></form>}<form action={deleteTrashedAction}><input type="hidden" name="submissionId" value={record.id} /><label>Permanent deletion reason<textarea name="reason" minLength={10} maxLength={1200} required /></label><label>Type DELETE to confirm<input name="confirmation" pattern="DELETE" required /></label><button className="button button--primary" type="submit">Permanently delete</button><small>This is irreversible. Storage objects are removed first.</small></form></>}</details>}

    {result.session.role === "admin" && result.audit.length > 0 && <details className="admin-panel admin-disclosure"><summary><span><small>Accountability</small><strong>Audit history</strong></span><span aria-hidden="true">+</span></summary><ol className="audit-list">{result.audit.map((event) => { const row = event as { id: number; action: string; created_at: string }; return <li key={row.id}><strong>{row.action}</strong><time>{new Date(row.created_at).toLocaleString("en-IN")}</time></li>; })}</ol></details>}
  </>;
}
