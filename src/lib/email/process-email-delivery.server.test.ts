import { describe, expect, it, vi } from "vitest";

import { processEmailDelivery, safeEmailErrorCode, type EmailClaim } from "@/lib/email/process-email-delivery.server";

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
  certificate_bucket: null,
  certificate_path: null,
};

const enabledConfiguration = {
  enabled: true,
  apiKey: "test-key",
  from: "Vriksha Test <test@example.test>",
  replyTo: "reply@example.test",
  targetEnvironment: "local" as const,
  testRecipient: null,
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
    expect(complete).toHaveBeenCalledWith(claim, "submission-received-v2", "provider-message-1");
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
      configuration: () => ({ ...enabledConfiguration, targetEnvironment: "staging", testRecipient: "approved-test@example.test" }),
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
  });
});
