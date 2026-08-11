"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";

import { resolveStaffSession, type StaffDalClient } from "@/lib/auth/dal";
import {
  applyRecoveryPasswordUpdate,
  GENERIC_RECOVERY_SENT_MESSAGE,
  MINIMUM_STAFF_PASSWORD_LENGTH,
  RECOVERY_E2E_COOKIE,
  RECOVERY_E2E_EMAIL,
  RECOVERY_E2E_PASSWORD,
  RECOVERY_MARKER_COOKIE,
  RECOVERY_MARKER_VALUE,
  recoveryRedirectUrl,
  validatePasswordUpdate,
  validateRecoveryEmail,
} from "@/lib/auth/password-recovery";
import { safeInternalDestination } from "@/lib/auth/redirects";
import { getPublicEnvironment } from "@/lib/env/public";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isStaffE2EAdapterEnabled, STAFF_E2E_COOKIE } from "@/lib/testing/staff-adapter";

const loginSchema = z.object({ email: z.email(), password: z.string().min(8).max(256) });

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const next = safeInternalDestination(formData.get("next"));
  if (!parsed.success) redirect(`/auth/login?error=1&next=${encodeURIComponent(next)}`);
  if (isStaffE2EAdapterEnabled()) {
    if (
      parsed.data.email === RECOVERY_E2E_EMAIL &&
      parsed.data.password === RECOVERY_E2E_PASSWORD
    ) {
      (await cookies()).set(STAFF_E2E_COOKIE, "admin", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
      redirect(next);
    }
    redirect(`/auth/login?error=1&next=${encodeURIComponent(next)}`);
  }
  const client = await createServerSupabaseClient();
  const { error } = await client.auth.signInWithPassword(parsed.data);
  if (error) redirect(`/auth/login?error=1&next=${encodeURIComponent(next)}`);
  const resolution = await resolveStaffSession(client as unknown as StaffDalClient);
  if (resolution.kind !== "staff") {
    await client.auth.signOut({ scope: "local" });
    redirect(`/auth/login?error=1&next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}

export type ForgotPasswordState = {
  status: "idle" | "invalid" | "sent";
  message: string;
};

export async function forgotPasswordAction(
  _previousState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = validateRecoveryEmail(formData.get("email"));
  if (!email) {
    return { status: "invalid", message: "Enter a valid email address." };
  }

  if (!isStaffE2EAdapterEnabled()) {
    const client = await createServerSupabaseClient();
    const environment = getPublicEnvironment();
    await client.auth.resetPasswordForEmail(email, {
      redirectTo: recoveryRedirectUrl(environment.NEXT_PUBLIC_SITE_URL),
    });
  }

  return { status: "sent", message: GENERIC_RECOVERY_SENT_MESSAGE };
}

export type SetPasswordState = {
  status: "idle" | "weak" | "mismatch" | "temporary-error";
  message: string;
};

export async function setPasswordAction(
  _previousState: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const password = formData.get("password");
  const confirmation = formData.get("passwordConfirmation");
  const validation = validatePasswordUpdate(password, confirmation);

  if (validation === "weak") {
    return {
      status: "weak",
      message: `Use at least ${MINIMUM_STAFF_PASSWORD_LENGTH} characters for the new password.`,
    };
  }
  if (validation === "mismatch") {
    return { status: "mismatch", message: "The passwords do not match." };
  }

  const cookieStore = await cookies();
  if (cookieStore.get(RECOVERY_MARKER_COOKIE)?.value !== RECOVERY_MARKER_VALUE) {
    redirect("/auth/login?recovery-required=1");
  }

  if (isStaffE2EAdapterEnabled()) {
    if (cookieStore.get(RECOVERY_E2E_COOKIE)?.value !== RECOVERY_MARKER_VALUE) {
      redirect("/auth/login?recovery-required=1");
    }
    cookieStore.delete(RECOVERY_MARKER_COOKIE);
    cookieStore.delete(RECOVERY_E2E_COOKIE);
    redirect("/auth/login?password-reset=1");
  }

  const client = await createServerSupabaseClient();
  const result = await applyRecoveryPasswordUpdate(client, password as string);
  if (result.kind === "no-session") {
    cookieStore.delete(RECOVERY_MARKER_COOKIE);
    redirect("/auth/login?recovery-required=1");
  }
  if (result.kind === "update-error") {
    return {
      status: "temporary-error",
      message: "The password could not be updated. Request a fresh link and try again.",
    };
  }

  cookieStore.delete(RECOVERY_MARKER_COOKIE);
  redirect("/auth/login?password-reset=1");
}

export async function logoutAction() {
  if (isStaffE2EAdapterEnabled()) {
    (await cookies()).delete(STAFF_E2E_COOKIE);
    redirect("/auth/login");
  }
  const client = await createServerSupabaseClient();
  await client.auth.signOut({ scope: "local" });
  redirect("/auth/login");
}
