import "server-only";

import { timingSafeEqual } from "node:crypto";

export class InternalAuthorizationConfigurationError extends Error {
  constructor() {
    super("internal_authorization_not_configured");
    this.name = "InternalAuthorizationConfigurationError";
  }
}

function internalSecret(environment: Record<string, string | undefined>): string {
  const value = (environment.INTERNAL_CRON_SECRET ?? environment.CRON_SECRET)?.trim();
  if (!value || value.length < 32) throw new InternalAuthorizationConfigurationError();
  return value;
}

export function isAuthorizedInternalRequest(
  request: Request,
  environment: Record<string, string | undefined> = process.env,
): boolean {
  const expected = Buffer.from(`Bearer ${internalSecret(environment)}`);
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function internalNoStoreJson(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
