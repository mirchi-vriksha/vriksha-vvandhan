"use client";

import { useActionState } from "react";

import {
  setPasswordAction,
  type SetPasswordState,
} from "@/app/auth/actions";
import { MINIMUM_STAFF_PASSWORD_LENGTH } from "@/lib/auth/password-recovery";

const initialSetPasswordState: SetPasswordState = {
  status: "idle",
  message: "",
};

export function SetPasswordForm() {
  const [state, action, pending] = useActionState(
    setPasswordAction,
    initialSetPasswordState,
  );

  return (
    <form action={action}>
      <label htmlFor="new-password">
        New password
        <input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MINIMUM_STAFF_PASSWORD_LENGTH}
          maxLength={256}
          aria-describedby="password-requirements"
          required
        />
      </label>
      <p id="password-requirements" className="auth-field-help">
        Use at least {MINIMUM_STAFF_PASSWORD_LENGTH} characters.
      </p>
      <label htmlFor="confirm-new-password">
        Confirm new password
        <input
          id="confirm-new-password"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          minLength={MINIMUM_STAFF_PASSWORD_LENGTH}
          maxLength={256}
          required
        />
      </label>
      {state.message ? (
        <div className="auth-error" role="alert">
          {state.message}
        </div>
      ) : null}
      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
