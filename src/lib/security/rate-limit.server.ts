import "server-only";

import { createHmac } from "node:crypto";
import { z } from "zod";

import { callUntypedRpc } from "@/lib/supabase/rpc.server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

type RateLimitEnvironment = Record<string, string | undefined>;

type RateLimitRule = {
  scope: string;
  limit: number;
  windowSeconds: number;
};

export class RateLimitUnavailableError extends Error {
  constructor() {
    super("rate_limit_unavailable");
    this.name = "RateLimitUnavailableError";
  }
}

function rateLimitSecret(environment: RateLimitEnvironment): string | null {
  const value = environment.ABUSE_HASH_SECRET?.trim();
  if (value && value.length >= 32) return value;
  if (environment.SUPABASE_TARGET_ENVIRONMENT === "production") {
    throw new RateLimitUnavailableError();
  }
  return null;
}

export function trustedClientAddress(request: Request): string | null {
  const vercelForwarded = request.headers.get("x-vercel-forwarded-for");
  const forwarded = vercelForwarded ?? request.headers.get("x-forwarded-for");
  const candidate = forwarded?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")?.trim()
    ?? null;
  if (!candidate || candidate.length > 128) return null;
  return candidate;
}

export function hashAbuseKey(
  value: string,
  environment: RateLimitEnvironment = process.env,
): string | null {
  const secret = rateLimitSecret(environment);
  return secret ? createHmac("sha256", secret).update(value).digest("hex") : null;
}

export async function consumeRateLimit(
  key: string,
  rules: readonly RateLimitRule[],
  environment: RateLimitEnvironment = process.env,
): Promise<boolean> {
  const keyHash = hashAbuseKey(key, environment);
  if (!keyHash) return true;

  for (const rule of rules) {
    const parsed = z.object({
      scope: z.string().regex(/^[a-z0-9:_-]{1,80}$/),
      limit: z.number().int().min(1).max(10_000),
      windowSeconds: z.number().int().min(1).max(86_400),
    }).parse(rule);
    const result = await callUntypedRpc<boolean>(
      getServiceSupabaseClient(),
      "consume_application_rate_limit",
      {
        p_scope: parsed.scope,
        p_key_hash: keyHash,
        p_limit: parsed.limit,
        p_window_seconds: parsed.windowSeconds,
      },
    );
    if (result.error) throw new RateLimitUnavailableError();
    if (result.data !== true) return false;
  }
  return true;
}

export const PREPARE_RATE_LIMITS = [
  { scope: "submission:prepare:minute", limit: 6, windowSeconds: 60 },
  { scope: "submission:prepare:hour", limit: 30, windowSeconds: 3_600 },
] as const;

export const FINALIZE_RATE_LIMITS = [
  { scope: "submission:finalize:15m", limit: 10, windowSeconds: 900 },
] as const;

export const EXPORT_RATE_LIMITS = [
  { scope: "admin:export:5m", limit: 2, windowSeconds: 300 },
] as const;
