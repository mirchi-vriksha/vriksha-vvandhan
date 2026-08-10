import "server-only";

import { z } from "zod";

const emailAddress = z.string().trim().email();

export type EmailConfiguration = {
  enabled: boolean;
  apiKey: string | null;
  from: string | null;
  replyTo: string | null;
  targetEnvironment: "local" | "staging" | "production";
  testRecipient: string | null;
};

export function getEmailConfiguration(environment: Record<string, string | undefined> = process.env): EmailConfiguration {
  const enabled = environment.EMAIL_SENDING_ENABLED === "true";
  const target = environment.SUPABASE_TARGET_ENVIRONMENT;
  const targetEnvironment = target === "staging" || target === "production" ? target : "local";
  if (!enabled) {
    return { enabled: false, apiKey: null, from: null, replyTo: null, targetEnvironment, testRecipient: null };
  }

  const apiKey = z.string().trim().min(1).parse(environment.RESEND_API_KEY);
  const from = z.string().trim().min(3).parse(environment.EMAIL_FROM);
  const replyTo = emailAddress.parse(environment.EMAIL_REPLY_TO);
  const testRecipient = environment.EMAIL_TEST_RECIPIENT
    ? emailAddress.parse(environment.EMAIL_TEST_RECIPIENT)
    : null;
  if (targetEnvironment === "staging" && !testRecipient) {
    throw new Error("staging_test_recipient_required");
  }
  if (targetEnvironment === "production" && testRecipient) {
    throw new Error("production_test_recipient_forbidden");
  }
  return { enabled, apiKey, from, replyTo, targetEnvironment, testRecipient };
}
