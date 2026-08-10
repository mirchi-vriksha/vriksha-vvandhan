import { handleResendWebhook } from "@/lib/email/resend-webhook.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleResendWebhook(request);
}
