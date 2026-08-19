/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";

import { approveSubmissionAction, confirmRejectionAction, deleteTrashedAction, recommendRejectionAction, restoreNonpublishedAction, restorePublishedAction, trashSubmissionAction } from "@/app/admin/actions";
import { AdminActionButton } from "@/components/admin/admin-action-button";
import { ReviewFieldsEditor } from "@/components/admin/review-fields-editor";
import { getSubmissionDetail } from "@/lib/moderation/data.server";

export const maxDuration = 60;

type DetailRecord = {
  id: string; status: string; display_name: string | null; submitted_at: string | null; guardian_number: number | null;
  rejection_comment: string | null; rejection_reason_code: string | null; rejection_participant_note: string | null; rejection_internal_note: string | null; rejection_recommended_at: string | null; rejected_at: string | null; trashed_at: string | null;
  submission_consents: { publication_consent: boolean; terms_accepted: boolean; accepted_at: string } | { publication_consent: boolean; terms_accepted: boolean; accepted_at: string }[];
  submission_media: { status: string; original_mime_type: string | null; original_bytes: number | null; original_width: number | null; original_height: number | null; review_thumbnail_width: number | null; review_thumbnail_height: number | null; review_thumbnail_bytes: number | null; focal_x: number | null; focal_y: number | null } | { status: string; original_mime_type: string | null; original_bytes: number | null; original_width: number | null; original_height: number | null; review_thumbnail_width: number | null; review_thumbnail_height: number | null; review_thumbnail_bytes: number | null; focal_x: number | null; focal_y: number | null }[];
  certificates: { id: string; status: string; template_version: string | null; generated_at: string | null; last_error_code: string | null } | { id: string; status: string; template_version: string | null; generated_at: string | null; last_error_code: string | null }[];
  email_deliveries: { id: string; kind: string; status: string; sent_at: string | null; last_error_code: string | null }[];
};

function one<T>(value: T | T[]): T { return Array.isArray(value) ? value[0] : value; }

function deliveryFeedback(delivery: string | undefined, kind: "approval" | "rejection") {
  const label = kind === "approval" ? "Certificate email" : "Rejection email";
  if (delivery === "sent") return ` ${label} was submitted to the email provider automatically.`;
  if (delivery === "disabled") return ` ${label} remains queued because email sending is disabled.`;
  if (delivery === "retrying") return ` ${label} is queued for retry in Deliveries.`;
  return "";
}

export default async function SubmissionDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string; delivery?: string; cleanup?: string; testAction?: string }> }) {
  const { id } = await params;
  const result = await getSubmissionDetail(id);
  if (!result) notFound();
  const record = result.record as unknown as DetailRecord;
  const media = one(record.submission_media);
  const consent = one(record.submission_consents);
  const certificate = one(record.certificates);
  const query = await searchParams;
  const guardianAssignment = record.guardian_number
    ? `Guardian #${record.guardian_number} has been assigned.`
    : "A Guardian number has been assigned.";
  const successMessage = query.success === "published"
    ? `Published successfully. ${guardianAssignment}${deliveryFeedback(query.delivery, "approval")}`
    : query.success === "rejection-recommended"
      ? "Rejection recommendation saved and sent to an Admin for the final decision."
      : query.success === "rejected"
        ? `Submission rejected successfully.${deliveryFeedback(query.delivery, "rejection")}`
        : query.success === "fields-saved"
          ? "Review fields saved."
          : query.success === "restored"
            ? "Submission restored successfully."
            : null;
  const reviewable = ["pending_review", "rejection_pending_admin"].includes(record.status) && !record.trashed_at;
  const canApprove = reviewable && (record.status === "pending_review" || result.session.role === "admin");
  const queueStatus = record.trashed_at ? "trashed" : record.status;
  const previewWidth = result.reviewImage?.source === "original" ? media?.original_width : media?.review_thumbnail_width;
  const previewHeight = result.reviewImage?.source === "original" ? media?.original_height : media?.review_thumbnail_height;
  const submissionPreview = result.reviewImage ? <figure className="admin-review-preview">
    <img src={result.reviewImage.signedUrl} alt="Private submitted photograph preview" width={previewWidth ?? 240} height={previewHeight ?? 300} loading="eager" decoding="async" />
    <figcaption>{result.reviewImage.source === "original" ? "Private original" : "Private preview"} · signed for 10 minutes</figcaption>
  </figure> : <p className="admin-review-preview__unavailable">Private preview is temporarily unavailable.</p>;

  const decisionPanel = reviewable ? <section className="admin-panel admin-actions admin-decision-panel" aria-labelledby="moderation-decision-title">
    <div><p>Decision</p><h2 id="moderation-decision-title">Moderation</h2></div>
    {canApprove && <form action={approveSubmissionAction}><input type="hidden" name="submissionId" value={record.id} /><AdminActionButton className="button button--primary" label="Approve and publish" pendingLabel="Approving and sending…" /><small>This publishes the promise, assigns its Guardian number, generates the certificate, and attempts the email before this page finishes.</small></form>}
    {result.session.role === "reviewer" && record.status === "pending_review" && <form action={recommendRejectionAction}><input type="hidden" name="submissionId" value={record.id} /><label>Reason shown to participant<select name="reasonCode" required defaultValue=""><option value="" disabled>Select a safe reason</option><option value="tree_or_rakhi_not_visible">Tree or Rakhi is not clearly visible</option><option value="image_quality">Image quality</option><option value="privacy_or_safety">Privacy or safety concern</option><option value="duplicate_submission">Duplicate submission</option><option value="campaign_mismatch">Does not match campaign guidelines</option><option value="other">Other campaign guideline</option></select></label><label>Optional participant guidance<textarea name="participantNote" maxLength={600} /></label><label>Internal moderation note<textarea name="internalNote" minLength={10} maxLength={1200} required /></label><AdminActionButton className="button button--light" label="Recommend Rejection" pendingLabel="Saving recommendation…" /><small>An Admin makes the final decision. The internal note is never emailed.</small></form>}
    {result.session.role === "reviewer" && record.status === "rejection_pending_admin" && <p className="admin-notice">This recommendation is waiting for an Admin decision.</p>}
    {result.session.role === "admin" && <form action={confirmRejectionAction}><input type="hidden" name="submissionId" value={record.id} /><label>Reason shown to participant<select name="reasonCode" required defaultValue={record.rejection_reason_code ?? ""}><option value="" disabled>Select a safe reason</option><option value="tree_or_rakhi_not_visible">Tree or Rakhi is not clearly visible</option><option value="image_quality">Image quality</option><option value="privacy_or_safety">Privacy or safety concern</option><option value="duplicate_submission">Duplicate submission</option><option value="campaign_mismatch">Does not match campaign guidelines</option><option value="other">Other campaign guideline</option></select></label><label>Optional participant guidance<textarea name="participantNote" defaultValue={record.rejection_participant_note ?? ""} maxLength={600} /></label><label>Internal moderation note<textarea name="internalNote" defaultValue={record.rejection_internal_note ?? record.rejection_comment ?? ""} minLength={10} maxLength={1200} required /></label><AdminActionButton className="button button--light" label={record.status === "rejection_pending_admin" ? "Confirm Rejection" : "Reject submission"} pendingLabel="Rejecting and sending…" /><small>Final rejection attempts the participant email before this page finishes. Internal notes remain private.</small></form>}
  </section> : null;

  return <>
    <Link className="admin-back-link" href={`/admin/submissions?status=${queueStatus}`}>← Back to Review Queue</Link>
    <header className="admin-page-header admin-submission-header"><div><p>Submission detail</p><h1>{record.display_name ?? "Participant submission"}</h1><span>Confirm the public display name, then make a decision.</span></div><span className={`status-badge status-badge--${record.status}`}>{record.status.replaceAll("_", " ")}</span></header>
    {successMessage && <div className="admin-success" role="status">{successMessage}</div>}
    {query.testAction && <div className="admin-success" role="status">Test moderation action completed: {query.testAction.replaceAll("-", " ")}.</div>}
    {query.cleanup === "required" && <div className="admin-notice" role="alert">The record is safely hidden, but its public image cleanup needs an Admin retry before permanent deletion.</div>}

    <div className={`admin-review-workspace${reviewable ? "" : " admin-review-workspace--single"}`}>
      {reviewable ? <section className="admin-panel admin-public-card-editor"><div><p>Public presentation</p><h2>Display name</h2><span>Confirm how the participant&apos;s name should appear publicly.</span></div>{submissionPreview}<ReviewFieldsEditor submissionId={record.id} displayName={record.display_name ?? ""} focalX={media?.focal_x ?? .5} focalY={media?.focal_y ?? .5} /></section>
        : <section className="admin-panel admin-review-image"><div><p>Private photograph</p><h2>Submission preview</h2></div>{submissionPreview}</section>}
      {decisionPanel}
    </div>

    <details className="admin-panel admin-disclosure" open>
      <summary><span><small>Reference</small><strong>Submission details</strong></span><span aria-hidden="true">+</span></summary>
      <dl className="admin-facts"><div><dt>Status</dt><dd>{record.status.replaceAll("_", " ")}</dd></div><div><dt>Submitted</dt><dd>{record.submitted_at ? new Date(record.submitted_at).toLocaleString("en-IN") : "—"}</dd></div><div><dt>Guardian number</dt><dd>{record.guardian_number ? `#${record.guardian_number}` : "Not assigned"}</dd></div><div><dt>Publication consent</dt><dd>{consent?.publication_consent ? "Confirmed" : "Missing"}</dd></div><div><dt>Terms accepted</dt><dd>{consent?.terms_accepted ? "Confirmed" : "Missing"}</dd></div><div><dt>Image</dt><dd>{media?.original_width ?? "—"} × {media?.original_height ?? "—"} · {media?.original_mime_type ?? "unknown"} · {media?.original_bytes ? `${Math.round(media.original_bytes / 1024)} KB` : "—"}</dd></div>{result.session.role === "admin" && <div><dt>Participant email</dt><dd>{result.email ?? "Unavailable"}</dd></div>}<div><dt>Certificate</dt><dd>{certificate?.status?.replaceAll("_", " ") ?? "Not started"}</dd></div></dl>
      {record.email_deliveries?.length > 0 && <div className="admin-deliveries"><h3>Participant notifications</h3>{record.email_deliveries.map(item => <p key={item.kind}>{item.kind.replaceAll("_", " ")}: <strong>{item.status.replaceAll("_", " ")}</strong>{item.sent_at ? ` · ${new Date(item.sent_at).toLocaleString("en-IN")}` : ""}</p>)}</div>}
      {result.session.role === "admin" && <p><Link href="/admin/deliveries?status=failed">Manage certificate and email deliveries</Link></p>}
    </details>

    {result.session.role === "admin" && <details className="admin-panel admin-disclosure admin-danger"><summary><span><small>Admin only</small><strong>Trash and deletion</strong></span><span aria-hidden="true">+</span></summary>{!record.trashed_at ? <form action={trashSubmissionAction}><input type="hidden" name="submissionId" value={record.id} /><p>Trash hides this record from public results immediately. Published Guardian numbers remain reserved.</p><label className="team-card__active"><input type="checkbox" required /> I understand the public visibility and count may change.</label><AdminActionButton className="button button--light" label="Move to Trash" pendingLabel="Moving to Trash…" /></form> : <>{record.status === "published" ? <form action={restorePublishedAction}><input type="hidden" name="submissionId" value={record.id} /><p>New immutable public variants will be generated before visibility returns.</p><AdminActionButton className="button button--light" label="Regenerate and restore publication" pendingLabel="Regenerating and restoring…" /></form> : <form action={restoreNonpublishedAction}><input type="hidden" name="submissionId" value={record.id} /><AdminActionButton className="button button--light" label="Restore record" pendingLabel="Restoring record…" /></form>}<form action={deleteTrashedAction}><input type="hidden" name="submissionId" value={record.id} /><label>Permanent deletion reason<textarea name="reason" minLength={10} maxLength={1200} required /></label><label>Type DELETE to confirm<input name="confirmation" pattern="DELETE" required /></label><AdminActionButton className="button button--primary" label="Permanently delete" pendingLabel="Deleting permanently…" /><small>This is irreversible. Storage objects are removed first.</small></form></>}</details>}

    {result.session.role === "admin" && result.audit.length > 0 && <details className="admin-panel admin-disclosure"><summary><span><small>Accountability</small><strong>Audit history</strong></span><span aria-hidden="true">+</span></summary><ol className="audit-list">{result.audit.map((event) => { const row = event as { id: number; action: string; created_at: string }; return <li key={row.id}><strong>{row.action}</strong><time>{new Date(row.created_at).toLocaleString("en-IN")}</time></li>; })}</ol></details>}
  </>;
}
