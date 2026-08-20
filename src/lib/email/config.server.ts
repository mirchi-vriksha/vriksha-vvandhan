import "server-only";

import { z } from "zod";

const emailAddress = z.string().trim().email();
const positiveInteger = z.coerce.number().int().positive();

export type EmailProvider = "resend" | "gmail_smtp";

export type EmailConfiguration = {
  enabled: boolean;
  provider: EmailProvider;
  apiKey: string | null;
  smtpUser: string | null;
  smtpAppPassword: string | null;
  from: string | null;
  replyTo: string | null;
  targetEnvironment: "local" | "staging" | "production";
  testRecipients: readonly string[];
  dailyLimit: number;
  batchSize: number;
  timeZone: string;
};

function emailProvider(environment: Record<string, string | undefined>): EmailProvider {
  const configured = environment.EMAIL_PROVIDER?.trim().toLowerCase();
  if (!configured || configured === "resend") return "resend" as const;
  if (["gmail", "gmail_smtp", "gmail-smtp"].includes(configured)) {
    return "gmail_smtp" as const;
  }
  throw new Error("email_provider_invalid");
}

function senderAddress(value: string): string {
  const match = value.match(/<([^<>]+)>\s*$/);
  return emailAddress.parse(match?.[1] ?? value).toLowerCase();
}

function timeZone(value: string | undefined): string {
  const candidate = value?.trim() || "Asia/Kolkata";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format();
    return candidate;
  } catch {
    throw new Error("email_timezone_invalid");
  }
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
  const provider = emailProvider(environment);
  const target = environment.SUPABASE_TARGET_ENVIRONMENT;
  const targetEnvironment = target === "staging" || target === "production" ? target : "local";
  const dailyLimit = positiveInteger.max(500).parse(environment.EMAIL_DAILY_LIMIT ?? "350");
  const batchSize = positiveInteger.max(25).parse(environment.EMAIL_BATCH_SIZE ?? "5");
  const configuredTimeZone = timeZone(environment.EMAIL_TIMEZONE);
  if (!enabled) {
    return {
      enabled: false,
      provider,
      apiKey: null,
      smtpUser: null,
      smtpAppPassword: null,
      from: null,
      replyTo: null,
      targetEnvironment,
      testRecipients: [],
      dailyLimit,
      batchSize,
      timeZone: configuredTimeZone,
    };
  }
  const from = z.string().trim().min(3).parse(environment.EMAIL_FROM);
  const replyTo = emailAddress.parse(environment.EMAIL_REPLY_TO);
  const apiKey = provider === "resend" ? z.string().trim().min(1).parse(environment.RESEND_API_KEY) : null;
  const smtpUser = provider === "gmail_smtp"
    ? emailAddress.parse(environment.GMAIL_SMTP_USER).toLowerCase()
    : null;
  const smtpAppPassword = provider === "gmail_smtp"
    ? z.string().transform((value) => value.replace(/\s+/g, "")).pipe(z.string().length(16)).parse(environment.GMAIL_SMTP_APP_PASSWORD)
    : null;
  if (provider === "gmail_smtp" && senderAddress(from) !== smtpUser) {
    throw new Error("gmail_sender_mismatch");
  }
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
    smtpAppPassword,
    from,
    replyTo,
    targetEnvironment,
    testRecipients,
    dailyLimit,
    batchSize,
    timeZone: configuredTimeZone,
  };
}
