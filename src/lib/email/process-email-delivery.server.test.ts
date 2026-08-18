import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
  close: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: mocks.createTransport },
}));

import { GmailSmtpProviderError, processEmailDelivery, ResendProviderError, safeEmailErrorCode, type EmailClaim } from "@/lib/email/process-email-delivery.server";

const claim: EmailClaim = {
  delivery_id: "d1000000-0000-4000-8000-000000000001",
  claim_token: "c1000000-0000-4000-8000-000000000001",
  submission_id: "s1000000-0000-4000-8000-000000000001",
  kind: "submission_received",
  idempotency_key: "submission_received:s1000000-0000-4000-8000-000000000001",
  recipient_email: "participant@example.test",
  display_name: "Asha Test",
  guardian_number: null,
  rejection_comment: null,
  rejection_reason_code: null,
  rejection_participant_note: null,
  certificate_bucket: null,
  certificate_path: null,
};

const enabledConfiguration = {
  enabled: true,
  provider: "resend" as const,
  apiKey: "test-key",
  smtpUser: null,
  smtpAppPassword: null,
  from: "Vriksha Test <test@example.test>",
  replyTo: "reply@example.test",
  targetEnvironment: "local" as const,
  testRecipients: [],
  dailyLimit: 350,
  batchSize: 5,
  timeZone: "Asia/Kolkata",
};

describe("processEmailDelivery", () => {
  it("does not claim or send while email delivery is disabled", async () => {
    const claimDelivery = vi.fn();
    const send = vi.fn();
    const result = await processEmailDelivery(claim.delivery_id, {
      configuration: () => ({ ...enabledConfiguration, enabled: false, apiKey: null, from: null, replyTo: null }),
      claim: claimDelivery,
      send,
    });
    expect(result).toEqual({ outcome: "disabled" });
    expect(claimDelivery).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("reuses the stable database key and stores the provider ID", async () => {
    const send = vi.fn().mockResolvedValue("provider-message-1");
    const complete = vi.fn().mockResolvedValue(true);
    const result = await processEmailDelivery(claim.delivery_id, {
      configuration: () => enabledConfiguration,
      claim: vi.fn().mockResolvedValue(claim),
      send,
      complete,
    });
    expect(result).toEqual({ outcome: "sent", providerMessageId: "provider-message-1" });
    expect(send.mock.calls[0][2]).toBe(claim.idempotency_key);
    expect(complete).toHaveBeenCalledWith(claim, "submission-received-v3", "provider-message-1");
  });

  it("sends through Gmail SMTP with a deterministic message ID", async () => {
    mocks.sendMail.mockResolvedValue({ messageId: "gmail-message-1" });
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail, close: mocks.close });
    const complete = vi.fn().mockResolvedValue(true);

    const result = await processEmailDelivery(claim.delivery_id, {
      configuration: () => ({
        ...enabledConfiguration,
        provider: "gmail_smtp",
        apiKey: null,
        smtpUser: "sender@example.test",
        smtpAppPassword: "app-password",
      }),
      claim: vi.fn().mockResolvedValue(claim),
      complete,
    });

    expect(result).toEqual({ outcome: "sent", providerMessageId: "gmail-message-1" });
    expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "sender@example.test", pass: "app-password" },
    }));
    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: [claim.recipient_email],
      messageId: expect.stringMatching(/^<[a-f0-9]{64}@example\.test>$/),
    }));
    expect(complete).toHaveBeenCalledWith(claim, "submission-received-v3", "gmail-message-1");
  });

  it("treats an unclaimable sent delivery as permanently ineligible", async () => {
    const send = vi.fn();
    expect(await processEmailDelivery(claim.delivery_id, {
      configuration: () => enabledConfiguration,
      claim: vi.fn().mockResolvedValue(null),
      send,
    })).toEqual({ outcome: "not_eligible" });
    expect(send).not.toHaveBeenCalled();
  });

  it("redirects staging sends only to the explicit test recipient without logging PII", async () => {
    const send = vi.fn().mockResolvedValue("provider-message-2");
    const log = vi.fn();
    await processEmailDelivery(claim.delivery_id, {
      configuration: () => ({ ...enabledConfiguration, targetEnvironment: "staging", testRecipients: ["approved-test@example.test"] }),
      claim: vi.fn().mockResolvedValue(claim),
      send,
      complete: vi.fn().mockResolvedValue(true),
      log,
    });
    expect(send.mock.calls[0][1].to).toEqual(["approved-test@example.test"]);
    expect(send.mock.calls[0][1].to).not.toContain(claim.recipient_email);
    expect(log).toHaveBeenCalledWith("staging recipient override active");
    expect(JSON.stringify(log.mock.calls)).not.toContain("@");
  });

  it("fails safely when an approval attachment is unavailable", async () => {
    const fail = vi.fn().mockResolvedValue(undefined);
    await expect(processEmailDelivery(claim.delivery_id, {
      configuration: () => enabledConfiguration,
      claim: vi.fn().mockResolvedValue({ ...claim, kind: "approval_certificate", guardian_number: 42 }),
      fail,
    })).rejects.toThrow("attachment_missing");
    expect(fail).toHaveBeenCalledWith(expect.anything(), "attachment_missing");
  });

  it("maps provider failures to bounded non-PII codes", () => {
    expect(safeEmailErrorCode(new Error("request timed out"))).toBe("resend_timeout");
    expect(safeEmailErrorCode(new Error("429 rate limited"))).toBe("resend_rate_limited");
    expect(safeEmailErrorCode(new Error("sender domain not verified"))).toBe("resend_invalid_sender");
    expect(safeEmailErrorCode(new Error("participant@example.test failed"))).toBe("resend_provider_error");
    expect(safeEmailErrorCode(new ResendProviderError({ name: "rate_limit_exceeded", message: "slow down", statusCode: 429 }))).toBe("resend_rate_limited");
    expect(safeEmailErrorCode(new ResendProviderError({ name: "invalid_from_address", message: "bad sender", statusCode: 422 }))).toBe("resend_invalid_sender");
    expect(safeEmailErrorCode(new ResendProviderError({ name: "internal_server_error", message: "provider unavailable", statusCode: 503 }))).toBe("resend_internal_server_error");
    expect(safeEmailErrorCode(new GmailSmtpProviderError("EAUTH", 535))).toBe("gmail_smtp_authentication_failed");
    expect(safeEmailErrorCode(new GmailSmtpProviderError("EENVELOPE", 550))).toBe("gmail_smtp_invalid_recipient");
    expect(safeEmailErrorCode(new GmailSmtpProviderError("ETIMEDOUT", null))).toBe("gmail_smtp_ambiguous");
    expect(safeEmailErrorCode(new GmailSmtpProviderError("ESMTP", 421))).toBe("gmail_smtp_temporary_error");
  });
});
