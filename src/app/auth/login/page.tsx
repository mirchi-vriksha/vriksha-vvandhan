import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";
import { LoginRecoveryNotice } from "@/components/auth/login-recovery-notice";
import { LogoLockup } from "@/components/shared/logo-lockup";
import { getOptionalStaffSession } from "@/lib/auth/dal";
import { safeInternalDestination } from "@/lib/auth/redirects";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Staff sign in | Vriksha Bandhan", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; "password-reset"?: string; "recovery-error"?: string; "recovery-required"?: string }> }) {
  const query = await searchParams;
  const session = await getOptionalStaffSession();
  if (session) redirect(safeInternalDestination(query.next));
  const next = safeInternalDestination(query.next);
  const recoveryNotice = query["password-reset"]
    ? "password-reset"
    : query["recovery-error"]
      ? "recovery-error"
      : query["recovery-required"]
        ? "recovery-required"
        : null;
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="staff-sign-in-title">
        <Link href="/" aria-label="Vriksha Bandhan home"><LogoLockup variant="compact" /></Link>
        <p className="auth-card__eyebrow">Invite-only campaign operations</p>
        <h1 id="staff-sign-in-title">Staff sign in</h1>
        <p>Use the company-managed account assigned to the Campaign Desk.</p>
        <LoginRecoveryNotice kind={recoveryNotice} />
        {query.error && <div className="auth-error" role="alert">Unable to sign in with those credentials.</div>}
        <LoginForm next={next} />
        <Link className="auth-card__secondary-link" href="/auth/forgot-password">Forgot password?</Link>
        <small>There is no public staff registration. Access is managed by Mirchi.</small>
      </section>
    </main>
  );
}
