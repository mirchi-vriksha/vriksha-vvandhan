import {
  InternalAuthorizationConfigurationError,
  internalNoStoreJson,
  isAuthorizedInternalRequest,
} from "@/lib/internal/authorization.server";
import { processDeliveryBacklog } from "@/lib/operations/process-deliveries.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request): Promise<Response> {
  try {
    if (!isAuthorizedInternalRequest(request)) {
      return internalNoStoreJson({ error: "unauthorized" }, 401);
    }
    const requestedValue = new URL(request.url).searchParams.get("batch");
    const requested = requestedValue === null ? undefined : Number(requestedValue);
    const batch = requested === undefined || !Number.isInteger(requested)
      ? undefined
      : Math.min(Math.max(requested, 1), 25);
    return internalNoStoreJson({ ok: true, ...(await processDeliveryBacklog(batch)) });
  } catch (error) {
    if (error instanceof InternalAuthorizationConfigurationError) {
      return internalNoStoreJson({ error: "not_configured" }, 503);
    }
    return internalNoStoreJson({ error: "temporarily_unavailable" }, 503);
  }
}

export const GET = handle;
export const POST = handle;
