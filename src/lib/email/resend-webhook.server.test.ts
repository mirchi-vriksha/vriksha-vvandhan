import { describe, expect, it, vi } from "vitest";

import { handleResendWebhook } from "@/lib/email/resend-webhook.server";

const headers = {
  "svix-id": "msg_webhook_123",
  "svix-timestamp": "1786348800",
  "svix-signature": "v1,test",
};

function request() {
  return new Request("https://campaign.example/api/webhooks/resend", {
    method: "POST",
    headers,
    body: JSON.stringify({ signed: true }),
  });
}

const event = {
  type: "email.delivered",
  created_at: "2026-08-10T07:00:00.000Z",
  data: { email_id: "resend-message-123", to: ["private@example.test"] },
};

describe("Resend webhook receiver", () => {
  it("verifies the raw body and records only delivery metadata", async () => {
    const verify = vi.fn().mockReturnValue(event);
    const record = vi.fn().mockResolvedValue(true);
    const response = await handleResendWebhook(request(), {
      environment: { RESEND_WEBHOOK_SECRET: "whsec_test" },
      dependencies: { verify, record },
    });
    expect(response.status).toBe(200);
    expect(record).toHaveBeenCalledWith({
      eventId: "msg_webhook_123",
      providerMessageId: "resend-message-123",
      eventType: "email.delivered",
      eventCreatedAt: "2026-08-10T07:00:00.000Z",
    });
    expect(JSON.stringify(record.mock.calls)).not.toContain("private@example.test");
  });

  it("acknowledges a duplicate idempotently", async () => {
    const response = await handleResendWebhook(request(), {
      environment: { RESEND_WEBHOOK_SECRET: "whsec_test" },
      dependencies: {
        verify: () => event,
        record: async () => false,
      },
    });
    expect(await response.json()).toEqual({ ok: true, duplicate: true });
  });

  it("rejects unsigned or invalid requests", async () => {
    const unsigned = await handleResendWebhook(new Request(
      "https://campaign.example/api/webhooks/resend",
      { method: "POST", body: "{}" },
    ));
    expect(unsigned.status).toBe(400);

    const invalid = await handleResendWebhook(request(), {
      environment: { RESEND_WEBHOOK_SECRET: "whsec_test" },
      dependencies: { verify: () => { throw new Error("bad signature"); } },
    });
    expect(invalid.status).toBe(400);
  });
});
