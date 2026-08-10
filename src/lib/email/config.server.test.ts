import { describe, expect, it } from "vitest";

import { getEmailConfiguration } from "@/lib/email/config.server";

describe("email delivery configuration", () => {
  it("is safely disabled without requiring provider secrets", () => {
    expect(getEmailConfiguration({ EMAIL_SENDING_ENABLED: "false", SUPABASE_TARGET_ENVIRONMENT: "staging" })).toEqual({
      enabled: false, apiKey: null, from: null, replyTo: null, targetEnvironment: "staging", testRecipient: null,
    });
  });

  it("requires an explicit recipient override whenever staging sends are enabled", () => {
    expect(() => getEmailConfiguration({
      EMAIL_SENDING_ENABLED: "true", SUPABASE_TARGET_ENVIRONMENT: "staging", RESEND_API_KEY: "test-key",
      EMAIL_FROM: "Vriksha Test <test@example.test>", EMAIL_REPLY_TO: "reply@example.test",
    })).toThrow("staging_test_recipient_required");
  });

  it("accepts a deliberate staging-only test recipient", () => {
    expect(getEmailConfiguration({
      EMAIL_SENDING_ENABLED: "true", SUPABASE_TARGET_ENVIRONMENT: "staging", RESEND_API_KEY: "test-key",
      EMAIL_FROM: "Vriksha Test <test@example.test>", EMAIL_REPLY_TO: "reply@example.test", EMAIL_TEST_RECIPIENT: "approved@example.test",
    }).testRecipient).toBe("approved@example.test");
  });

  it("forbids a staging recipient override in production", () => {
    expect(() => getEmailConfiguration({
      EMAIL_SENDING_ENABLED: "true", SUPABASE_TARGET_ENVIRONMENT: "production", RESEND_API_KEY: "test-key",
      EMAIL_FROM: "Vriksha Test <test@example.test>", EMAIL_REPLY_TO: "reply@example.test", EMAIL_TEST_RECIPIENT: "qa@example.test",
    })).toThrow("production_test_recipient_forbidden");
  });
});
