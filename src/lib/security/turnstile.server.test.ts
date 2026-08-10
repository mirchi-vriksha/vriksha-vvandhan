import { describe, expect, it, vi } from "vitest";

import {
  getTurnstileConfiguration,
  TurnstileVerificationError,
  verifyTurnstileToken,
} from "@/lib/security/turnstile.server";

const enabledEnvironment = {
  SUPABASE_TARGET_ENVIRONMENT: "staging",
  TURNSTILE_ENABLED: "true",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test-site-key",
  TURNSTILE_SECRET_KEY: "test-secret-key",
};

describe("Turnstile server verification", () => {
  it("does nothing when explicitly disabled outside production", async () => {
    const fetcher = vi.fn();
    await expect(verifyTurnstileToken(undefined, null, {
      environment: { TURNSTILE_ENABLED: "false" },
      fetcher,
    })).resolves.toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("accepts a valid Siteverify result", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      action: "public_submission_prepare",
    }), { status: 200 }));
    await expect(verifyTurnstileToken("valid-token", "203.0.113.10", {
      environment: enabledEnvironment,
      fetcher,
    })).resolves.toBeUndefined();
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).not.toContain("203.0.113.10&");
  });

  it.each([
    ["invalid", ["invalid-input-response"]],
    ["duplicate", ["timeout-or-duplicate"]],
    ["expired", ["timeout-or-duplicate"]],
  ])("rejects an %s token", async (_label, errorCodes) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      "error-codes": errorCodes,
    }), { status: 200 }));
    await expect(verifyTurnstileToken("bad-token", null, {
      environment: enabledEnvironment,
      fetcher,
    })).rejects.toMatchObject({ reason: "invalid" });
  });

  it("rejects a missing token without calling Siteverify", async () => {
    const fetcher = vi.fn();
    await expect(verifyTurnstileToken(undefined, null, {
      environment: enabledEnvironment,
      fetcher,
    })).rejects.toBeInstanceOf(TurnstileVerificationError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails safely on timeout or network failure", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("network timeout"));
    await expect(verifyTurnstileToken("token", null, {
      environment: enabledEnvironment,
      fetcher,
    })).rejects.toMatchObject({ reason: "unavailable" });
  });

  it("requires Turnstile in production", () => {
    expect(() => getTurnstileConfiguration({
      SUPABASE_TARGET_ENVIRONMENT: "production",
      TURNSTILE_ENABLED: "false",
    })).toThrow("turnstile_required_in_production");
  });
});
