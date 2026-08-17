import "server-only";

import { z } from "zod";

const emailAddress = z.string().trim().email();

export type EmailConfiguration = {
  enabled: boolean;
  apiKey: string | null;
  from: string | null;
  replyTo: string | null;
  targetEnvironment: "local" | "staging" | "production";
  testRecipients: readonly string[];
};

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
    return { enabled: false, apiKey: null, from: null, replyTo: null, targetEnvironment, testRecipients: [] };
  }

  const apiKey = z.string().trim().min(1).parse(environment.RESEND_API_KEY);
  const from = z.string().trim().min(3).parse(environment.EMAIL_FROM);
  const replyTo = emailAddress.parse(environment.EMAIL_REPLY_TO);
  const testRecipients = stagingRecipients(environment);
  if (targetEnvironment === "staging" && testRecipients.length === 0) {
    throw new Error("staging_test_recipient_required");
  }
  if (targetEnvironment === "production" && testRecipients.length > 0) {
    throw new Error("production_test_recipient_forbidden");
  }
  return { enabled, apiKey, from, replyTo, targetEnvironment, testRecipients };
}
