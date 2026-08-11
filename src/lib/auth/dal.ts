import "server-only";

import { cookies } from "next/headers";

import { ForbiddenError, UnauthenticatedError } from "@/lib/auth/errors";
import { hasRole } from "@/lib/auth/permissions";
import type { StaffRole, StaffSession } from "@/lib/auth/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isStaffE2EAdapterEnabled, STAFF_E2E_COOKIE, staffE2ESession } from "@/lib/testing/staff-adapter";

type VerifiedClaims = {
  sub?: string;
  email?: unknown;
};

type StaffProfileRecord = {
  id: string;
  display_name: string;
  role: StaffRole;
  active: boolean;
};

export type StaffDalClient = {
  auth: {
    getClaims: () => Promise<{
      data: { claims: VerifiedClaims | null } | null;
      error: unknown;
    }>;
  };
  from: (table: "staff_profiles") => {
    select: (columns: string) => {
      eq: (column: "id", value: string) => {
        maybeSingle: () => Promise<{
          data: StaffProfileRecord | null;
          error: unknown;
        }>;
      };
    };
  };
};

type StaffResolution =
  | { kind: "unauthenticated" }
  | { kind: "forbidden" }
  | { kind: "staff"; session: StaffSession };

export async function resolveStaffSession(
  client: StaffDalClient,
): Promise<StaffResolution> {
  const { data: claimsData, error: claimsError } = await client.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return { kind: "unauthenticated" };
  }

  const { data: profile, error: profileError } = await client
    .from("staff_profiles")
    .select("id, display_name, role, active")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile || !profile.active) {
    return { kind: "forbidden" };
  }

  return {
    kind: "staff",
    session: {
      userId: profile.id,
      email:
        typeof claimsData?.claims?.email === "string"
          ? claimsData.claims.email
          : null,
      displayName: profile.display_name,
      role: profile.role,
    },
  };
}

export async function getOptionalStaffSessionWithClient(
  client: StaffDalClient,
): Promise<StaffSession | null> {
  const resolution = await resolveStaffSession(client);
  return resolution.kind === "staff" ? resolution.session : null;
}

export async function getOptionalStaffSession(): Promise<StaffSession | null> {
  if (isStaffE2EAdapterEnabled()) {
    const role = (await cookies()).get(STAFF_E2E_COOKIE)?.value;
    return role === "admin" || role === "reviewer"
      ? staffE2ESession(role)
      : null;
  }
  const client = await createServerSupabaseClient();
  return getOptionalStaffSessionWithClient(
    client as unknown as StaffDalClient,
  );
}

export async function requireStaffWithClient(
  client: StaffDalClient,
): Promise<StaffSession> {
  const resolution = await resolveStaffSession(client);

  if (resolution.kind === "unauthenticated") {
    throw new UnauthenticatedError();
  }

  if (resolution.kind === "forbidden") {
    throw new ForbiddenError("No active staff profile is assigned to this user.");
  }

  return resolution.session;
}

export async function requireStaff(): Promise<StaffSession> {
  if (isStaffE2EAdapterEnabled()) {
    const role = (await cookies()).get(STAFF_E2E_COOKIE)?.value;
    if (role === "admin" || role === "reviewer") return staffE2ESession(role);
    throw new UnauthenticatedError();
  }
  const client = await createServerSupabaseClient();
  return requireStaffWithClient(client as unknown as StaffDalClient);
}

export async function requireRole(
  ...roles: readonly StaffRole[]
): Promise<StaffSession> {
  const session = await requireStaff();

  if (!hasRole(session, roles)) {
    throw new ForbiddenError();
  }

  return session;
}
