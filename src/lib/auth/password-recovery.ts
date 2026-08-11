export const MINIMUM_STAFF_PASSWORD_LENGTH = 8;
export const RECOVERY_MARKER_COOKIE = "vriksha-password-recovery";
export const RECOVERY_E2E_COOKIE = "vriksha-e2e-password-recovery";
export const RECOVERY_MARKER_VALUE = "verified";
export const RECOVERY_E2E_TOKEN = "safe-e2e-recovery-token";
export const RECOVERY_E2E_EMAIL = "recovery@example.test";
export const RECOVERY_E2E_PASSWORD = "SafeTestPass123!";

export const GENERIC_RECOVERY_SENT_MESSAGE =
  "If an eligible staff account exists for that email, a password reset link has been sent.";

export type PasswordUpdateResult =
  | { kind: "success" }
  | { kind: "no-session" }
  | { kind: "update-error" };

type PasswordUpdateClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
    updateUser: (attributes: { password: string }) => Promise<{ error: unknown }>;
    signOut: (options: { scope: "local" }) => Promise<{ error: unknown }>;
  };
};

type RecoveryVerificationClient = {
  auth: {
    verifyOtp: (parameters: {
      token_hash: string;
      type: "recovery";
    }) => Promise<{ error: unknown }>;
  };
};

export function recoveryRedirectUrl(siteUrl: string): string {
  const url = new URL("/auth/confirm", new URL(siteUrl).origin);
  url.searchParams.set("next", "/auth/set-password");
  return url.toString();
}

export function safeRecoveryDestination(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/auth/set-password";
  }

  try {
    const url = new URL(value, "http://internal.local");
    if (url.origin !== "http://internal.local" || url.pathname !== "/auth/set-password") {
      return "/auth/set-password";
    }
    return "/auth/set-password";
  } catch {
    return "/auth/set-password";
  }
}

export function validateRecoveryEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function validatePasswordUpdate(
  password: unknown,
  confirmation: unknown,
): "valid" | "weak" | "mismatch" {
  if (
    typeof password !== "string" ||
    password.length < MINIMUM_STAFF_PASSWORD_LENGTH ||
    password.length > 256
  ) {
    return "weak";
  }
  return password === confirmation ? "valid" : "mismatch";
}

export async function verifyRecoveryToken(
  client: RecoveryVerificationClient,
  tokenHash: string | null,
  type: string | null,
): Promise<boolean> {
  if (!tokenHash || type !== "recovery") return false;
  const { error } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });
  return !error;
}

export async function applyRecoveryPasswordUpdate(
  client: PasswordUpdateClient,
  password: string,
): Promise<PasswordUpdateResult> {
  const { data, error: userError } = await client.auth.getUser();
  if (userError || !data.user) return { kind: "no-session" };

  const { error: updateError } = await client.auth.updateUser({ password });
  if (updateError) return { kind: "update-error" };

  await client.auth.signOut({ scope: "local" });
  return { kind: "success" };
}
