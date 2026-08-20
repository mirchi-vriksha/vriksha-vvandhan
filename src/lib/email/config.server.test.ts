import { describe, expect, it } from "vitest";

import { getEmailConfiguration } from "@/lib/email/config.server";

describe("email delivery configuration", () => {
  it("is safely disabled without requiring provider secrets", () => {
    expect(getEmailConfiguration({ EMAIL_SENDING_ENABLED: "false", SUPABASE_TARGET_ENVIRONMENT: "staging" })).toEqual({
      enabled: false, provider: null, apiKey: null, smtpUser: null, smtpPassword: null,
      from: null, replyTo: null, targetEnvironment: "staging", testRecipients: [],
    });
  });

  it("supports the configured Gmail SMTP provider", () => {
    expect(getEmailConfiguration({
      EMAIL_SENDING_ENABLED: "true", EMAIL_PROVIDER: "gmail_smtp",
      GMAIL_SMTP_USER: "sender@example.test", GMAIL_SMTP_APP_PASSWORD: "app-password",
      EMAIL_FROM: "Vriksha Test <sender@example.test>", EMAIL_REPLY_TO: "reply@example.test",
      SUPABASE_TARGET_ENVIRONMENT: "production",
    })).toMatchObject({
      enabled: true,
      provider: "gmail_smtp",
      apiKey: null,
      smtpUser: "sender@example.test",
      smtpPassword: "app-password",
    });
  });

  it("rejects an unsupported email provider", () => {
    expect(() => getEmailConfiguration({
      EMAIL_SENDING_ENABLED: "true", EMAIL_PROVIDER: "unknown",
      EMAIL_FROM: "Vriksha Test <sender@example.test>", EMAIL_REPLY_TO: "reply@example.test",
      SUPABASE_TARGET_ENVIRONMENT: "production",
    })).toThrow("email_provider_invalid");
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
    }).testRecipients).toEqual(["approved@example.test"]);
  });

  it("accepts at most five normalized staging recipients", () => {
    expect(getEmailConfiguration({
      EMAIL_SENDING_ENABLED: "true", SUPABASE_TARGET_ENVIRONMENT: "staging", RESEND_API_KEY: "test-key",
      EMAIL_FROM: "Vriksha Test <test@example.test>", EMAIL_REPLY_TO: "reply@example.test",
      EMAIL_TEST_RECIPIENTS: "ONE@example.test, two@example.test, ONE@example.test",
    }).testRecipients).toEqual(["one@example.test", "two@example.test"]);
    expect(() => getEmailConfiguration({
      EMAIL_SENDING_ENABLED: "true", SUPABASE_TARGET_ENVIRONMENT: "staging", RESEND_API_KEY: "test-key",
      EMAIL_FROM: "Vriksha Test <test@example.test>", EMAIL_REPLY_TO: "reply@example.test",
      EMAIL_TEST_RECIPIENTS: "a@e.test,b@e.test,c@e.test,d@e.test,e@e.test,f@e.test",
    })).toThrow("staging_test_recipient_limit");
  });

  it("forbids a staging recipient override in production", () => {
    expect(() => getEmailConfiguration({
      EMAIL_SENDING_ENABLED: "true", SUPABASE_TARGET_ENVIRONMENT: "production", RESEND_API_KEY: "test-key",
      EMAIL_FROM: "Vriksha Test <test@example.test>", EMAIL_REPLY_TO: "reply@example.test", EMAIL_TEST_RECIPIENT: "qa@example.test",
    })).toThrow("production_test_recipient_forbidden");
  });

  it("forbids the plural allowlist in production", () => {
    expect(() => getEmailConfiguration({
      EMAIL_SENDING_ENABLED: "true", SUPABASE_TARGET_ENVIRONMENT: "production", RESEND_API_KEY: "test-key",
      EMAIL_FROM: "Vriksha Test <test@example.test>", EMAIL_REPLY_TO: "reply@example.test", EMAIL_TEST_RECIPIENTS: "qa@example.test",
    })).toThrow("production_test_recipient_forbidden");
  });
});
