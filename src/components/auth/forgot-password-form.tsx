"use client";

import { useActionState } from "react";

import {
  forgotPasswordAction,
  type ForgotPasswordState,
} from "@/app/auth/actions";

const initialForgotPasswordState: ForgotPasswordState = {
  status: "idle",
  message: "",
};

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    forgotPasswordAction,
    initialForgotPasswordState,
  );

  return (
    <form action={action} noValidate>
      <label htmlFor="recovery-email">
        Email address
        <input
          id="recovery-email"
          name="email"
          type="email"
          autoComplete="username"
          aria-invalid={state.status === "invalid" ? true : undefined}
          aria-describedby={state.message ? "recovery-request-message" : undefined}
          required
        />
      </label>
      {state.message ? (
        <div
          id="recovery-request-message"
          className={state.status === "sent" ? "auth-success" : "auth-error"}
          role={state.status === "sent" ? "status" : "alert"}
        >
          {state.message}
        </div>
      ) : null}
      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send password reset link"}
      </button>
    </form>
  );
}
