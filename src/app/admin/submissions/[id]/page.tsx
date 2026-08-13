/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import Link from "next/link";

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
  const success = query.success;
  const successMessage =
    success === "published"
      ? `Published successfully. Guardian #${record.guardian_number} has been assigned.`
      : success === "rejection-recommended"
        ? "Rejection recommendation saved and sent to an Admin for the final decision."
        : success === "rejected"
          ? "Submission rejected successfully."
          : null;
  const reviewable = ["pending_review", "rejection_pending_admin"].includes(record.status) && !record.trashed_at;
  const canApprove = reviewable && (record.status === "pending_review" || result.session.role === "admin");
  return <>
    <header className="admin-page-header"><div><p>Submission detail</p><h1>{record.display_name ?? "Participant submission"}</h1></div><span className={`status-badge status-badge--${record.status}`}>{record.status.replaceAll("_", " ")}</span></header>
    {successMessage && <div className="admin-success" role="status">{successMessage}</div>}
    {query.testAction && <div className="admin-success" role="status">Test moderation action completed: {query.testAction.replaceAll("-", " ")}.</div>}
    {query.cleanup === "required" && <div className="admin-notice" role="alert">The record is safely hidden, but its public image cleanup needs an Admin retry before permanent deletion.</div>}
    <div className="admin-detail-grid">
      <section className="admin-panel admin-review-image"><h2>Private review thumbnail</h2>{result.reviewThumbnail ? <><img src={result.reviewThumbnail.signedUrl} alt="Private submitted photograph preview" width="240" height="300" loading="eager" decoding="async" /><small>Private 240 × 300 preview · signed for 10 minutes</small></> : <p>Private preview is temporarily unavailable. The full original remains available below when present.</p>}</section>
      <section className="admin-panel"><h2>Submission facts</h2><dl className="admin-facts"><div><dt>Status</dt><dd>{record.status.replaceAll("_", " ")}</dd></div><div><dt>Submitted</dt><dd>{record.submitted_at ? new Date(record.submitted_at).toLocaleString("en-IN") : "—"}</dd></div><div><dt>Guardian number</dt><dd>{record.guardian_number ? `#${record.guardian_number}` : "Not assigned"}</dd></div><div><dt>Publication consent</dt><dd>{consent?.publication_consent ? "Confirmed" : "Missing"}</dd></div><div><dt>Terms accepted</dt><dd>{consent?.terms_accepted ? "Confirmed" : "Missing"}</dd></div><div><dt>Image</dt><dd>{media?.original_width ?? "—"} × {media?.original_height ?? "—"} · {media?.original_mime_type ?? "unknown"} · {media?.original_bytes ? `${Math.round(media.original_bytes / 1024)} KB` : "—"}</dd></div>{result.session.role === "admin" && <div><dt>Participant email</dt><dd>{result.email ?? "Unavailable"}</dd></div>}<div><dt>Certificate</dt><dd>{certificate?.status?.replaceAll("_", " ") ?? "Not started"}</dd></div></dl>
        {record.email_deliveries?.length > 0 && <div className="admin-deliveries"><h3>Participant notifications</h3>{record.email_deliveries.map(item => <p key={item.kind}>{item.kind.replaceAll("_", " ")}: <strong>{item.status.replaceAll("_", " ")}</strong>{item.sent_at ? ` · ${new Date(item.sent_at).toLocaleString("en-IN")}` : ""}</p>)}</div>}
        {result.session.role === "admin" && <p><Link href="/admin/deliveries">Manage certificate and email deliveries</Link></p>}
      </section>
    </div>
    {reviewable && result.reviewImage && <section className="admin-panel"><h2>Review fields</h2><FocalPointEditor submissionId={record.id} displayName={record.display_name ?? ""} imageUrl={result.reviewImage.signedUrl} previewUrl={result.reviewThumbnail?.signedUrl} initialX={media?.focal_x ?? .5} initialY={media?.focal_y ?? .5} /></section>}
    {reviewable && <section className="admin-panel admin-actions"><h2>Moderation decision</h2>{canApprove && <form action={approveSubmissionAction}><input type="hidden" name="submissionId" value={record.id} /><button className="button button--primary" type="submit">Approve and publish</button><small>Reviewers can approve and publish a pending submission directly.</small></form>}
      {result.session.role === "reviewer" && record.status === "pending_review" && <form action={recommendRejectionAction}><input type="hidden" name="submissionId" value={record.id} /><label>Participant-facing recommendation comment<textarea name="comment" minLength={10} maxLength={1200} required /></label><button className="button button--light" type="submit">Recommend Rejection</button><small>Admin makes the final decision. A recommendation never sends email.</small></form>}
      {result.session.role === "admin" && <form action={confirmRejectionAction}><input type="hidden" name="submissionId" value={record.id} /><label>Participant-facing rejection comment<textarea name="comment" defaultValue={record.rejection_comment ?? ""} minLength={10} maxLength={1200} required /></label><button className="button button--light" type="submit">{record.status === "rejection_pending_admin" ? "Confirm Rejection" : "Reject submission"}</button><small>Final rejection queues the participant notification; delivery failures do not change this decision.</small></form>}
    </section>}
    {result.session.role === "admin" && <section className="admin-panel admin-danger"><h2>Admin controls</h2>{!record.trashed_at ? <form action={trashSubmissionAction}><input type="hidden" name="submissionId" value={record.id} /><p>Trash hides this record from public results immediately. Published Guardian numbers remain reserved.</p><label className="team-card__active"><input type="checkbox" required /> I understand the public visibility and count may change.</label><button className="button button--light" type="submit">Move to Trash</button></form> : <>{record.status === "published" ? <form action={restorePublishedAction}><input type="hidden" name="submissionId" value={record.id} /><p>New immutable public variants will be generated before visibility returns.</p><button className="button button--light" type="submit">Regenerate and restore publication</button></form> : <form action={restoreNonpublishedAction}><input type="hidden" name="submissionId" value={record.id} /><button className="button button--light" type="submit">Restore record</button></form>}<form action={deleteTrashedAction}><input type="hidden" name="submissionId" value={record.id} /><label>Permanent deletion reason<textarea name="reason" minLength={10} maxLength={1200} required /></label><label>Type DELETE to confirm<input name="confirmation" pattern="DELETE" required /></label><button className="button button--primary" type="submit">Permanently delete</button><small>This is irreversible. Storage objects are removed first.</small></form></>}</section>}
    {result.session.role === "admin" && result.audit.length > 0 && <section className="admin-panel"><h2>Audit history</h2><ol className="audit-list">{result.audit.map((event) => { const row = event as { id: number; action: string; created_at: string }; return <li key={row.id}><strong>{row.action}</strong><time>{new Date(row.created_at).toLocaleString("en-IN")}</time></li>; })}</ol></section>}
  </>;
}
