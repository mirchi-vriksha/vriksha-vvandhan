import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SetPasswordForm } from "@/components/auth/set-password-form";
import { LogoLockup } from "@/components/shared/logo-lockup";
import {
  RECOVERY_E2E_COOKIE,
  RECOVERY_MARKER_COOKIE,
  RECOVERY_MARKER_VALUE,
} from "@/lib/auth/password-recovery";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isStaffE2EAdapterEnabled } from "@/lib/testing/staff-adapter";

export const metadata: Metadata = {
  title: "Set new staff password | Vriksha Bandhan",
  robots: { index: false, follow: false },
};

export default async function SetPasswordPage() {
  const cookieStore = await cookies();
  const hasRecoveryMarker =
    cookieStore.get(RECOVERY_MARKER_COOKIE)?.value === RECOVERY_MARKER_VALUE;

  if (!hasRecoveryMarker) redirect("/auth/login?recovery-required=1");

  if (isStaffE2EAdapterEnabled()) {
    if (cookieStore.get(RECOVERY_E2E_COOKIE)?.value !== RECOVERY_MARKER_VALUE) {
      redirect("/auth/login?recovery-required=1");
    }
  } else {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) {
      cookieStore.delete(RECOVERY_MARKER_COOKIE);
      redirect("/auth/login?recovery-required=1");
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="set-password-title">
        <Link href="/" aria-label="Vriksha Bandhan home">
          <LogoLockup variant="compact" />
        </Link>
        <p className="auth-card__eyebrow">Verified recovery session</p>
        <h1 id="set-password-title">Set a new password</h1>
        <p>Choose a strong password for your company-managed staff account.</p>
        <SetPasswordForm />
      </section>
    </main>
  );
}
