import { describe, expect, it } from "vitest";

import { getEmailConfiguration } from "@/lib/email/config.server";

describe("email delivery configuration", () => {
  it("is safely disabled without requiring provider secrets", () => {
    expect(getEmailConfiguration({ EMAIL_SENDING_ENABLED: "false", SUPABASE_TARGET_ENVIRONMENT: "staging" })).toEqual({
      enabled: false,
      provider: "resend",
      apiKey: null,
      smtpUser: null,
      smtpAppPassword: null,
      from: null,
      replyTo: null,
      targetEnvironment: "staging",
      testRecipients: [],
      dailyLimit: 350,
      batchSize: 5,
      timeZone: "Asia/Kolkata",
    });
  });

  it("accepts Gmail SMTP only when its app-password sender matches", () => {
    const configuration = getEmailConfiguration({
      EMAIL_SENDING_ENABLED: "true",
      EMAIL_PROVIDER: "gmail_smtp",
      SUPABASE_TARGET_ENVIRONMENT: "staging",
      GMAIL_SMTP_USER: "vrikshabandhan@gmail.com",
      GMAIL_SMTP_APP_PASSWORD: "abcd efgh ijkl mnop",
      EMAIL_FROM: "Vriksha Bandhan <vrikshabandhan@gmail.com>",
      EMAIL_REPLY_TO: "vrikshabandhan@gmail.com",
      EMAIL_TEST_RECIPIENT: "approved@example.test",
      EMAIL_DAILY_LIMIT: "350",
      EMAIL_BATCH_SIZE: "5",
      EMAIL_TIMEZONE: "Asia/Kolkata",
    });
    expect(configuration).toMatchObject({
      provider: "gmail_smtp",
      apiKey: null,
      smtpUser: "vrikshabandhan@gmail.com",
      smtpAppPassword: "abcdefghijklmnop",
      dailyLimit: 350,
      batchSize: 5,
      timeZone: "Asia/Kolkata",
    });
  });

  it("rejects a Gmail sender that differs from the authenticated mailbox", () => {
    expect(() => getEmailConfiguration({
      EMAIL_SENDING_ENABLED: "true",
      EMAIL_PROVIDER: "gmail_smtp",
      SUPABASE_TARGET_ENVIRONMENT: "staging",
      GMAIL_SMTP_USER: "vrikshabandhan@gmail.com",
      GMAIL_SMTP_APP_PASSWORD: "abcdefghijklmnop",
      EMAIL_FROM: "Vriksha Bandhan <different@gmail.com>",
      EMAIL_REPLY_TO: "vrikshabandhan@gmail.com",
      EMAIL_TEST_RECIPIENT: "approved@example.test",
    })).toThrow("gmail_sender_mismatch");
  });

  it("rejects invalid quota and timezone settings", () => {
    expect(() => getEmailConfiguration({ EMAIL_SENDING_ENABLED: "false", EMAIL_DAILY_LIMIT: "501" })).toThrow();
    expect(() => getEmailConfiguration({ EMAIL_SENDING_ENABLED: "false", EMAIL_BATCH_SIZE: "0" })).toThrow();
    expect(() => getEmailConfiguration({ EMAIL_SENDING_ENABLED: "false", EMAIL_TIMEZONE: "Not/AZone" })).toThrow("email_timezone_invalid");
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
