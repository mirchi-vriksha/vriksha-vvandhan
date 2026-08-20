import { saveReviewFieldsAction } from "@/app/admin/actions";
import { AdminActionButton } from "@/components/admin/admin-action-button";

export function ReviewFieldsEditor({ submissionId, displayName, focalX, focalY }: { submissionId: string; displayName: string; focalX: number; focalY: number }) {
  return (
    <form className="review-fields-editor" action={saveReviewFieldsAction}>
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="focalX" value={focalX} />
      <input type="hidden" name="focalY" value={focalY} />
      <label>Public display name<input name="displayName" defaultValue={displayName} required maxLength={100} /></label>
      <AdminActionButton className="button button--light" label="Save review fields" pendingLabel="Saving review fields…" />
    </form>
  );
}
