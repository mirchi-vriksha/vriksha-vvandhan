import { NextRequest, NextResponse } from "next/server";

import {
  RECOVERY_E2E_COOKIE,
  RECOVERY_E2E_TOKEN,
  RECOVERY_MARKER_COOKIE,
  RECOVERY_MARKER_VALUE,
  safeRecoveryDestination,
  verifyRecoveryToken,
} from "@/lib/auth/password-recovery";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";
import { isStaffE2EAdapterEnabled } from "@/lib/testing/staff-adapter";

const recoveryCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/auth",
  maxAge: 15 * 60,
};

function internalRedirect(destination: string) {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: destination },
  });
}

function failureResponse() {
  return internalRedirect("/auth/login?recovery-error=1");
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const destination = safeRecoveryDestination(url.searchParams.get("next"));

  if (!tokenHash || type !== "recovery") return failureResponse();

  const response = internalRedirect(destination);

  if (isStaffE2EAdapterEnabled()) {
    if (tokenHash !== RECOVERY_E2E_TOKEN) return failureResponse();
    response.cookies.set(
      RECOVERY_E2E_COOKIE,
      RECOVERY_MARKER_VALUE,
      recoveryCookieOptions,
    );
  } else {
    const client = createRouteHandlerSupabaseClient(request, response);
    const verified = await verifyRecoveryToken(client, tokenHash, type);
    if (!verified) return failureResponse();
  }

  response.cookies.set(
    RECOVERY_MARKER_COOKIE,
    RECOVERY_MARKER_VALUE,
    recoveryCookieOptions,
  );
  return response;
}
