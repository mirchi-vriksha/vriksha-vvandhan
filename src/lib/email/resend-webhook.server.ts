import "server-only";

import { Resend } from "resend";
import { z } from "zod";

import { callUntypedRpc } from "@/lib/supabase/rpc.server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const usefulEventSchema = z.object({
  type: z.enum([
    "email.delivered",
    "email.bounced",
    "email.complained",
    "email.delivery_delayed",
    "email.failed",
  ]),
  created_at: z.iso.datetime({ offset: true }),
  data: z.object({ email_id: z.string().min(1).max(240) }).passthrough(),
}).passthrough();

type WebhookDependencies = {
  verify: (input: {
    payload: string;
    headers: { id: string; timestamp: string; signature: string };
    webhookSecret: string;
  }) => unknown;
  record: (input: {
    eventId: string;
    providerMessageId: string;
    eventType: string;
    eventCreatedAt: string;
  }) => Promise<boolean>;
};

function webhookSecret(environment: Record<string, string | undefined>): string {
  const value = environment.RESEND_WEBHOOK_SECRET?.trim();
  if (!value) throw new Error("resend_webhook_not_configured");
  return value;
}

const defaults: WebhookDependencies = {
  verify(input) {
    return new Resend().webhooks.verify(input);
  },
  async record(input) {
    const result = await callUntypedRpc<boolean>(
      getServiceSupabaseClient(),
      "record_resend_webhook_event",
      {
        p_event_id: input.eventId,
        p_provider_message_id: input.providerMessageId,
        p_event_type: input.eventType,
        p_event_created_at: input.eventCreatedAt,
      },
    );
    if (result.error) throw new Error("resend_webhook_record_failed");
    return result.data === true;
  },
};

const noStoreHeaders = { "Cache-Control": "private, no-store, max-age=0" };

export async function handleResendWebhook(
  request: Request,
  options: {
    environment?: Record<string, string | undefined>;
    dependencies?: Partial<WebhookDependencies>;
  } = {},
): Promise<Response> {
  const eventId = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!eventId || !timestamp || !signature || eventId.length > 240) {
    return Response.json({ error: "invalid_webhook" }, { status: 400, headers: noStoreHeaders });
  }

  let payload: string;
  try {
    payload = await request.text();
    if (new TextEncoder().encode(payload).byteLength > 65_536) {
      return Response.json({ error: "invalid_webhook" }, { status: 413, headers: noStoreHeaders });
    }
    const dependencies = { ...defaults, ...options.dependencies };
    const verified = dependencies.verify({
      payload,
      headers: { id: eventId, timestamp, signature },
      webhookSecret: webhookSecret(options.environment ?? process.env),
    });

    const event = usefulEventSchema.safeParse(verified);
    if (!event.success) {
      return Response.json({ ok: true, ignored: true }, { headers: noStoreHeaders });
    }
    const recorded = await dependencies.record({
      eventId,
      providerMessageId: event.data.data.email_id,
      eventType: event.data.type,
      eventCreatedAt: event.data.created_at,
    });
    return Response.json(
      { ok: true, duplicate: !recorded },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    const status = error instanceof Error && error.message === "resend_webhook_not_configured"
      ? 503
      : 400;
    return Response.json(
      { error: status === 503 ? "not_configured" : "invalid_webhook" },
      { status, headers: noStoreHeaders },
    );
  }
}
