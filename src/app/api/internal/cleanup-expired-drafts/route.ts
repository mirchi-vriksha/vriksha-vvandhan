import {
  InternalAuthorizationConfigurationError,
  internalNoStoreJson,
  isAuthorizedInternalRequest,
} from "@/lib/internal/authorization.server";
import { cleanupExpiredDrafts } from "@/lib/operations/cleanup-expired-drafts.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request): Promise<Response> {
  try {
    if (!isAuthorizedInternalRequest(request)) {
      return internalNoStoreJson({ error: "unauthorized" }, 401);
    }
    const requested = Number(new URL(request.url).searchParams.get("batch") ?? 50);
    const batch = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 100) : 50;
    return internalNoStoreJson({ ok: true, ...(await cleanupExpiredDrafts(batch)) });
  } catch (error) {
    if (error instanceof InternalAuthorizationConfigurationError) {
      return internalNoStoreJson({ error: "not_configured" }, 503);
    }
    return internalNoStoreJson({ error: "temporarily_unavailable" }, 503);
  }
}

export const GET = handle;
export const POST = handle;
