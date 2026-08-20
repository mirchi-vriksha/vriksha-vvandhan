"use client";

import { useFormStatus } from "react-dom";

import { loginAction } from "@/app/auth/actions";

function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="button button--primary"
      type="submit"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? <span className="admin-action-spinner" aria-hidden="true" /> : null}
      <span>{pending ? "Signing in…" : "Sign in securely"}</span>
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  return (
    <form action={loginAction}>
      <input type="hidden" name="next" value={next} />
      <label>
        Email address
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" minLength={8} required />
      </label>
      <LoginSubmitButton />
    </form>
  );
}
