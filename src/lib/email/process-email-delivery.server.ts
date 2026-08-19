import "server-only";

import { createHash } from "node:crypto";
import nodemailer from "nodemailer";
import { Resend, type ErrorResponse } from "resend";

import { buildCertificateFilename } from "@/lib/certificates/certificate-format";
import { getEmailConfiguration, type EmailConfiguration } from "@/lib/email/config.server";
import { approvalCertificateEmail } from "@/lib/email/templates/approval-certificate";
import { rejectionEmail, type RejectionReasonCode } from "@/lib/email/templates/rejection";
import { submissionReceivedEmail } from "@/lib/email/templates/submission-received";
import type { TransactionalEmail } from "@/lib/email/templates/shared";
import { CERTIFICATES_BUCKET } from "@/lib/storage/buckets";
import { callUntypedRpc } from "@/lib/supabase/rpc.server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

type EmailKind = "submission_received" | "approval_certificate" | "rejection";

export type EmailClaim = {
  delivery_id: string;
  claim_token: string;
  submission_id: string;
  kind: EmailKind;
  idempotency_key: string;
  recipient_email: string;
  display_name: string;
  guardian_number: number | null;
  rejection_comment: string | null;
  rejection_reason_code: string | null;
  rejection_participant_note: string | null;
  certificate_bucket: string | null;
  certificate_path: string | null;
};

export class ResendProviderError extends Error {
  constructor(readonly providerError: ErrorResponse) {
    super("resend_provider_error");
    this.name = "ResendProviderError";
  }
}

export class SmtpProviderError extends Error {
  constructor(
    readonly code: string | null,
    readonly responseCode: number | null,
  ) {
    super("smtp_provider_error");
    this.name = "SmtpProviderError";
  }
}

type SendInput = {
  from: string;
  to: string[];
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: Buffer }[];
};

type ProcessorDependencies = {
  configuration: () => EmailConfiguration;
  claim: (deliveryId: string) => Promise<EmailClaim | null>;
  downloadCertificate: (path: string) => Promise<Buffer>;
  send: (configuration: EmailConfiguration, input: SendInput, idempotencyKey: string) => Promise<string>;
  complete: (claim: EmailClaim, templateVersion: string, providerMessageId: string) => Promise<boolean>;
  fail: (claim: EmailClaim, errorCode: string) => Promise<void>;
  log: (message: string) => void;
};

function templateFor(claim: EmailClaim): TransactionalEmail {
  if (claim.kind === "submission_received") return submissionReceivedEmail(claim.display_name);
  if (claim.kind === "approval_certificate") {
    if (!claim.guardian_number) throw new Error("attachment_missing");
    return approvalCertificateEmail(claim.display_name, claim.guardian_number);
  }
  const reasonCode = claim.rejection_reason_code as RejectionReasonCode | null;
  if (!reasonCode) throw new Error("rejection_reason_missing");
  return rejectionEmail(claim.display_name, reasonCode, claim.rejection_participant_note);
}

export function safeEmailErrorCode(error: unknown): string {
  if (error instanceof ResendProviderError) {
    const { name, statusCode } = error.providerError;
    if (name === "rate_limit_exceeded" || statusCode === 429) return "resend_rate_limited";
    if (name === "internal_server_error" || statusCode === 500 || statusCode === 502 || statusCode === 503 || statusCode === 504) return "resend_internal_server_error";
    if (name === "concurrent_idempotent_requests") return "resend_concurrent_idempotency";
    if (name === "invalid_from_address") return "resend_invalid_sender";
    if (name === "invalid_parameter" || name === "validation_error") return "resend_validation_error";
    if (["invalid_idempotency_key", "invalid_idempotent_request", "invalid_attachment", "missing_api_key", "restricted_api_key", "invalid_api_key", "monthly_quota_exceeded", "daily_quota_exceeded", "security_error"].includes(name)) {
      return `resend_${name}`.slice(0, 80);
    }
  }
  if (error instanceof SmtpProviderError) {
    if (["ETIMEDOUT", "ESOCKET", "ECONNECTION"].includes(error.code ?? "")) return "resend_timeout";
    if (error.responseCode === 421 || error.responseCode === 450 || error.responseCode === 451 || error.responseCode === 452) return "resend_temporary_error";
    if (error.responseCode === 429) return "resend_rate_limited";
    if (error.responseCode === 550 || error.responseCode === 551 || error.responseCode === 553) return "resend_invalid_recipient";
    if (error.code === "EAUTH" || error.responseCode === 535) return "resend_invalid_api_key";
    return "resend_provider_error";
  }
  if (error instanceof Error) {
    if (["attachment_missing", "rejection_reason_missing", "email_completion_failed", "provider_message_id_missing"].includes(error.message)) return error.message;
    const message = error.message.toLowerCase();
    if (message.includes("timeout") || message.includes("timed out")) return "resend_timeout";
    if (message.includes("rate") || message.includes("429")) return "resend_rate_limited";
    if (message.includes("sender") || message.includes("domain")) return "resend_invalid_sender";
    if (message.includes("recipient") || message.includes("invalid_email")) return "resend_invalid_recipient";
    if (/\b5\d\d\b/.test(message) || message.includes("temporar")) return "resend_temporary_error";
  }
  return "resend_provider_error";
}

const defaults: ProcessorDependencies = {
  configuration: getEmailConfiguration,
  async claim(deliveryId) {
    const result = await callUntypedRpc<EmailClaim[]>(getServiceSupabaseClient(), "claim_email_delivery", {
      p_delivery_id: deliveryId,
      p_allow_exhausted: false,
    });
    if (result.error) throw new Error("email_claim_failed");
    return result.data?.[0] ?? null;
  },
  async downloadCertificate(path) {
    const result = await getServiceSupabaseClient().storage.from(CERTIFICATES_BUCKET).download(path);
    if (result.error || !result.data) throw new Error("attachment_missing");
    return Buffer.from(await result.data.arrayBuffer());
  },
  async send(configuration, input, idempotencyKey) {
    if (configuration.provider === "gmail_smtp") {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: configuration.smtpUser!,
          pass: configuration.smtpPassword!,
        },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
      });
      const messageIdHash = createHash("sha256").update(idempotencyKey).digest("hex");
      const messageDomain = configuration.smtpUser!.split("@")[1] ?? "vriksha-bandhan.invalid";
      try {
        const result = await transporter.sendMail({
          ...input,
          messageId: `<${messageIdHash}@${messageDomain}>`,
        });
        if (!result.messageId) throw new Error("provider_message_id_missing");
        return result.messageId;
      } catch (error) {
        if (error instanceof Error && error.message === "provider_message_id_missing") throw error;
        const smtpError = error as { code?: unknown; responseCode?: unknown };
        throw new SmtpProviderError(
          typeof smtpError.code === "string" ? smtpError.code : null,
          typeof smtpError.responseCode === "number" ? smtpError.responseCode : null,
        );
      }
    }

    const resend = new Resend(configuration.apiKey!);
    const result = await resend.emails.send(input, { idempotencyKey });
    if (result.error) throw new ResendProviderError(result.error);
    if (!result.data?.id) throw new Error("provider_message_id_missing");
    return result.data.id;
  },
  async complete(claim, templateVersion, providerMessageId) {
    const result = await callUntypedRpc<boolean>(getServiceSupabaseClient(), "complete_email_delivery", {
      p_delivery_id: claim.delivery_id,
      p_claim_token: claim.claim_token,
      p_template_version: templateVersion,
      p_provider_message_id: providerMessageId,
    });
    if (result.error) throw new Error("email_completion_failed");
    return result.data === true;
  },
  async fail(claim, errorCode) {
    await callUntypedRpc(getServiceSupabaseClient(), "fail_email_delivery", {
      p_delivery_id: claim.delivery_id,
      p_claim_token: claim.claim_token,
      p_error_code: errorCode,
    });
  },
  log: (message) => console.info(message),
};

export async function processEmailDelivery(
  deliveryId: string,
  dependencies: Partial<ProcessorDependencies> = {},
  options: { allowExhaustedRetry?: boolean } = {},
): Promise<{ outcome: "disabled" | "not_eligible" | "sent"; providerMessageId?: string }> {
  const processor = { ...defaults, ...dependencies };
  if (options.allowExhaustedRetry && !dependencies.claim) {
    processor.claim = async (id) => {
      const result = await callUntypedRpc<EmailClaim[]>(getServiceSupabaseClient(), "claim_email_delivery", {
        p_delivery_id: id,
        p_allow_exhausted: true,
      });
      if (result.error) throw new Error("email_claim_failed");
      return result.data?.[0] ?? null;
    };
  }
  const configuration = processor.configuration();
  if (!configuration.enabled) return { outcome: "disabled" };
  const claim = await processor.claim(deliveryId);
  if (!claim) return { outcome: "not_eligible" };

  try {
    const template = templateFor(claim);
    const recipient = configuration.targetEnvironment === "staging"
      ? configuration.testRecipients.find((value) => value === claim.recipient_email.trim().toLowerCase()) ?? configuration.testRecipients[0]!
      : claim.recipient_email;
    if (configuration.targetEnvironment === "staging") processor.log("staging recipient override active");

    let attachments: SendInput["attachments"];
    if (claim.kind === "approval_certificate") {
      if (!claim.certificate_path || claim.certificate_bucket !== CERTIFICATES_BUCKET || !claim.guardian_number) {
        throw new Error("attachment_missing");
      }
      attachments = [{
        filename: buildCertificateFilename(claim.guardian_number),
        content: await processor.downloadCertificate(claim.certificate_path),
      }];
    }

    const providerMessageId = await processor.send(configuration, {
      from: configuration.from!,
      to: [recipient],
      replyTo: configuration.replyTo!,
      subject: template.subject,
      html: template.html,
      text: template.text,
      attachments,
    }, claim.idempotency_key);
    if (!(await processor.complete(claim, template.templateVersion, providerMessageId))) {
      throw new Error("email_completion_failed");
    }
    return { outcome: "sent", providerMessageId };
  } catch (error) {
    await processor.fail(claim, safeEmailErrorCode(error)).catch(() => undefined);
    throw error;
  }
}
