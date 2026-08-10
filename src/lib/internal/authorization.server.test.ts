import { describe, expect, it } from "vitest";

import {
  InternalAuthorizationConfigurationError,
  isAuthorizedInternalRequest,
} from "@/lib/internal/authorization.server";

const secret = "s".repeat(32);

describe("internal endpoint authorization", () => {
  it("accepts only the exact Bearer secret", () => {
    const accepted = new Request("https://campaign.example/api/internal/job", {
      headers: { authorization: `Bearer ${secret}` },
    });
    const rejected = new Request("https://campaign.example/api/internal/job", {
      headers: { authorization: `Bearer ${secret}x` },
    });
    expect(isAuthorizedInternalRequest(accepted, { INTERNAL_CRON_SECRET: secret })).toBe(true);
    expect(isAuthorizedInternalRequest(rejected, { INTERNAL_CRON_SECRET: secret })).toBe(false);
  });

  it("fails closed when no strong secret is configured", () => {
    expect(() => isAuthorizedInternalRequest(
      new Request("https://campaign.example/api/internal/job"),
      {},
    )).toThrow(InternalAuthorizationConfigurationError);
  });
});
