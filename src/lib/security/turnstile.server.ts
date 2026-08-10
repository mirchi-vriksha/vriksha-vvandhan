import "server-only";

import { z } from "zod";

const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_ACTION = "public_submission_prepare";

type TurnstileEnvironment = Record<string, string | undefined>;

export type TurnstileConfiguration =
  | { enabled: false; siteKey: null; secretKey: null }
  | { enabled: true; siteKey: string; secretKey: string };

const siteverifyResponseSchema = z.object({
  success: z.boolean(),
  action: z.string().optional(),
  "error-codes": z.array(z.string()).optional(),
});

export class TurnstileVerificationError extends Error {
  constructor(public readonly reason: "missing" | "invalid" | "unavailable") {
    super("turnstile_verification_failed");
    this.name = "TurnstileVerificationError";
  }
}

export function getTurnstileConfiguration(
  environment: TurnstileEnvironment = process.env,
): TurnstileConfiguration {
  const production = environment.SUPABASE_TARGET_ENVIRONMENT === "production";
  const enabled = environment.TURNSTILE_ENABLED === "true";

  if (production && !enabled) {
    throw new Error("turnstile_required_in_production");
  }
  if (!enabled) return { enabled: false, siteKey: null, secretKey: null };

  return {
    enabled: true,
    siteKey: z.string().trim().min(1).parse(environment.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    secretKey: z.string().trim().min(1).parse(environment.TURNSTILE_SECRET_KEY),
  };
}

export function getPublicTurnstileConfiguration(
  environment: TurnstileEnvironment = process.env,
): { enabled: boolean; siteKey: string | null } {
  const configuration = getTurnstileConfiguration(environment);
  return { enabled: configuration.enabled, siteKey: configuration.siteKey };
}

export async function verifyTurnstileToken(
  token: string | undefined,
  remoteIp: string | null,
  options: {
    environment?: TurnstileEnvironment;
    fetcher?: typeof fetch;
  } = {},
): Promise<void> {
  const configuration = getTurnstileConfiguration(options.environment);
  if (!configuration.enabled) return;
  if (!token) throw new TurnstileVerificationError("missing");

  const form = new URLSearchParams({
    secret: configuration.secretKey,
    response: token,
  });
  if (remoteIp) form.set("remoteip", remoteIp);

  try {
    const response = await (options.fetcher ?? fetch)(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (!response.ok) throw new TurnstileVerificationError("unavailable");
    const result = siteverifyResponseSchema.parse(await response.json());
    if (!result.success || (result.action && result.action !== TURNSTILE_ACTION)) {
      throw new TurnstileVerificationError("invalid");
    }
  } catch (error) {
    if (error instanceof TurnstileVerificationError) throw error;
    throw new TurnstileVerificationError("unavailable");
  }
}

export const TURNSTILE_WIDGET_ACTION = TURNSTILE_ACTION;
