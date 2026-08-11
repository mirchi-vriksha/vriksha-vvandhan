import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { LogoLockup } from "@/components/shared/logo-lockup";

export const metadata: Metadata = {
  title: "Reset staff password | Vriksha Bandhan",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="forgot-password-title">
        <Link href="/" aria-label="Vriksha Bandhan home">
          <LogoLockup variant="compact" />
        </Link>
        <p className="auth-card__eyebrow">Secure staff access</p>
        <h1 id="forgot-password-title">Reset your password</h1>
        <p>Enter the company-managed email used for the Campaign Desk.</p>
        <ForgotPasswordForm />
        <Link className="auth-card__secondary-link" href="/auth/login">
          Back to staff sign in
        </Link>
      </section>
    </main>
  );
}
