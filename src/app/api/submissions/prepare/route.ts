import { ZodError } from "zod";

import { jsonApiError } from "@/lib/submissions/api-errors";
import {
  consumeRateLimit,
  PREPARE_RATE_LIMITS,
  trustedClientAddress,
} from "@/lib/security/rate-limit.server";
import {
  TurnstileVerificationError,
  verifyTurnstileToken,
} from "@/lib/security/turnstile.server";
import { acceptsSmallJson, isSameOriginRequest } from "@/lib/submissions/origin.server";
import {
  prepareSubmissionRequestSchema,
  type PrepareSubmissionRequest,
} from "@/lib/submissions/schemas";
import {
  preparePublicSubmission,
  SubmissionServiceError,
} from "@/lib/submissions/service.server";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request) || !acceptsSmallJson(request)) {
    return jsonApiError("invalid_request", 400);
  }

  let input: PrepareSubmissionRequest;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 16_384) {
      return jsonApiError("invalid_request", 413);
    }
    input = prepareSubmissionRequestSchema.parse(JSON.parse(rawBody));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return jsonApiError("invalid_request", 400);
    }
    return jsonApiError("temporarily_unavailable", 503);
  }

  try {
    const remoteIp = trustedClientAddress(request);
    const allowed = await consumeRateLimit(
      `ip:${remoteIp ?? "unavailable"}`,
      PREPARE_RATE_LIMITS,
    );
    if (!allowed) return jsonApiError("rate_limited", 429);
    await verifyTurnstileToken(input.turnstileToken, remoteIp);
    return Response.json(await preparePublicSubmission(input), {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof TurnstileVerificationError) {
      return jsonApiError("verification_failed", error.reason === "unavailable" ? 503 : 400);
    }
    if (error instanceof SubmissionServiceError) {
      const status =
        error.code === "submissions_closed" ? 409 :
          error.code === "submission_limit_reached" ? 429 :
            error.code === "draft_expired" ? 410 : 503;
      return jsonApiError(error.code, status);
    }
    return jsonApiError("temporarily_unavailable", 503);
  }
}
