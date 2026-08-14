import { saveReviewFieldsAction } from "@/app/admin/actions";

export function ReviewFieldsEditor({ submissionId, displayName, focalX, focalY }: { submissionId: string; displayName: string; focalX: number; focalY: number }) {
  return (
    <form className="review-fields-editor" action={saveReviewFieldsAction}>
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="focalX" value={focalX} />
      <input type="hidden" name="focalY" value={focalY} />
      <label>Public display name<input name="displayName" defaultValue={displayName} required maxLength={100} /></label>
      <button className="button button--light" type="submit">Save review fields</button>
    </form>
  );
}
