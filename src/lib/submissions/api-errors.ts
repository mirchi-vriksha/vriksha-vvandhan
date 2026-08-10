import type { PublicApiError, PublicApiErrorCode } from "@/lib/submissions/schemas";

const messages: Record<PublicApiErrorCode, string> = {
  invalid_request: "Check the highlighted details and try again.",
  submissions_closed: "Submissions are not open right now. Please return to the movement soon.",
  submission_limit_reached: "This address has reached the current submission limit. Please try again later.",
  rate_limited: "Too many attempts were made. Please wait a moment and try again.",
  verification_failed: "We couldn’t verify this submission. Please try again.",
  draft_expired: "Your secure submission session expired. Start a new submission and try again.",
  invalid_draft: "We could not verify this secure submission session. Please start again.",
  consent_required: "Publication consent and campaign terms must both be accepted.",
  media_not_ready: "The photograph is not ready yet. Please retry the secure upload.",
  invalid_image: "That photograph could not be verified. Please choose a JPEG, PNG or WebP image.",
  already_submitted: "This submission has already been received.",
  temporarily_unavailable: "Submissions are temporarily unavailable. Your details have not been sent.",
};

const retryableCodes = new Set<PublicApiErrorCode>([
  "media_not_ready",
  "verification_failed",
  "temporarily_unavailable",
]);

export function toPublicApiError(code: PublicApiErrorCode): PublicApiError {
  return {
    success: false,
    code,
    message: messages[code],
    retryable: retryableCodes.has(code),
  };
}

export function mapDatabaseError(error: unknown): PublicApiErrorCode {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : "";

  const known = [
    "submissions_closed",
    "submission_limit_reached",
    "draft_expired",
    "invalid_draft",
    "consent_required",
    "media_not_ready",
    "already_submitted",
  ] as const;

  return known.find((code) => message.includes(code)) ?? "temporarily_unavailable";
}

export function jsonApiError(code: PublicApiErrorCode, status: number): Response {
  return Response.json(toPublicApiError(code), {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
