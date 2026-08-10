import { describe, expect, it } from "vitest";

import {
  hashAbuseKey,
  RateLimitUnavailableError,
  trustedClientAddress,
} from "@/lib/security/rate-limit.server";

describe("application rate limit privacy", () => {
  it("prefers the Vercel-provided address and stores only a stable HMAC", () => {
    const request = new Request("https://campaign.example/api", {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.7, 198.51.100.4",
        "x-forwarded-for": "192.0.2.1",
      },
    });
    const address = trustedClientAddress(request);
    const hash = hashAbuseKey(`ip:${address}`, { ABUSE_HASH_SECRET: "a".repeat(32) });
    expect(address).toBe("203.0.113.7");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(address!);
  });

  it("is disabled for controlled local development without a secret", () => {
    expect(hashAbuseKey("local", {})).toBeNull();
  });

  it("fails closed in production without a strong server secret", () => {
    expect(() => hashAbuseKey("production", {
      SUPABASE_TARGET_ENVIRONMENT: "production",
      ABUSE_HASH_SECRET: "short",
    })).toThrow(RateLimitUnavailableError);
  });
});
