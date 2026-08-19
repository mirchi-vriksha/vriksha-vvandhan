import "server-only";

import { z } from "zod";

const emailAddress = z.string().trim().email();

export type EmailConfiguration = {
  enabled: boolean;
  provider: "resend" | "gmail_smtp" | null;
  apiKey: string | null;
  smtpUser: string | null;
  smtpPassword: string | null;
  from: string | null;
  replyTo: string | null;
  targetEnvironment: "local" | "staging" | "production";
  testRecipients: readonly string[];
};

function emailProvider(environment: Record<string, string | undefined>) {
  const configured = environment.EMAIL_PROVIDER?.trim().toLowerCase();
  if (!configured || configured === "resend") return "resend" as const;
  if (["gmail", "gmail_smtp", "gmail-smtp"].includes(configured)) {
    return "gmail_smtp" as const;
  }
  throw new Error("email_provider_invalid");
}

function stagingRecipients(environment: Record<string, string | undefined>): string[] {
  const plural = environment.EMAIL_TEST_RECIPIENTS?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
  const singular = environment.EMAIL_TEST_RECIPIENT?.trim();
  const values = plural.length ? plural : singular ? [singular] : [];
  if (values.length > 5) throw new Error("staging_test_recipient_limit");
  return [...new Set(values.map((value) => emailAddress.parse(value).toLowerCase()))];
}

export function getEmailConfiguration(environment: Record<string, string | undefined> = process.env): EmailConfiguration {
  const enabled = environment.EMAIL_SENDING_ENABLED === "true";
  const target = environment.SUPABASE_TARGET_ENVIRONMENT;
  const targetEnvironment = target === "staging" || target === "production" ? target : "local";
  if (!enabled) {
    return {
      enabled: false,
      provider: null,
      apiKey: null,
      smtpUser: null,
      smtpPassword: null,
      from: null,
      replyTo: null,
      targetEnvironment,
      testRecipients: [],
    };
  }

  const provider = emailProvider(environment);
  const apiKey = provider === "resend"
    ? z.string().trim().min(1).parse(environment.RESEND_API_KEY)
    : null;
  const smtpUser = provider === "gmail_smtp"
    ? emailAddress.parse(environment.GMAIL_SMTP_USER)
    : null;
  const smtpPassword = provider === "gmail_smtp"
    ? z.string().trim().min(1).parse(environment.GMAIL_SMTP_APP_PASSWORD)
    : null;
  const from = z.string().trim().min(3).parse(environment.EMAIL_FROM);
  const replyTo = emailAddress.parse(environment.EMAIL_REPLY_TO);
  const testRecipients = stagingRecipients(environment);
  if (targetEnvironment === "staging" && testRecipients.length === 0) {
    throw new Error("staging_test_recipient_required");
  }
  if (targetEnvironment === "production" && testRecipients.length > 0) {
    throw new Error("production_test_recipient_forbidden");
  }
  return {
    enabled,
    provider,
    apiKey,
    smtpUser,
    smtpPassword,
    from,
    replyTo,
    targetEnvironment,
    testRecipients,
  };
}
