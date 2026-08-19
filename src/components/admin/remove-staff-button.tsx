"use client";

import { useFormStatus } from "react-dom";

export function RemoveStaffButton({
  displayName,
  disabled = false,
}: {
  displayName: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className="button team-card__remove"
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      onClick={(event) => {
        if (!window.confirm(`Permanently remove ${displayName} and their sign-in account?`)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? <span className="admin-action-spinner" aria-hidden="true" /> : null}
      <span>{pending ? "Removing…" : "Remove member"}</span>
    </button>
  );
}
