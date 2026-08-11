import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createRouteHandlerSupabaseClient: mocks.createClient,
}));
vi.mock("@/lib/testing/staff-adapter", () => ({
  isStaffE2EAdapterEnabled: () => false,
}));

import { GET } from "@/app/auth/confirm/route";

function request(query: string) {
  return new NextRequest(`https://campaign.example/auth/confirm?${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifyOtp.mockResolvedValue({ error: null });
  mocks.createClient.mockReturnValue({ auth: { verifyOtp: mocks.verifyOtp } });
});

describe("recovery confirmation route", () => {
  it("verifies a recovery token, stores the marker, and redirects internally", async () => {
    const response = await GET(request(
      "token_hash=hashed-test-token&type=recovery&next=%2Fauth%2Fset-password",
    ));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/auth/set-password");
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      token_hash: "hashed-test-token",
      type: "recovery",
    });
    expect(response.cookies.get("vriksha-password-recovery")?.value).toBe("verified");
    expect(response.headers.get("set-cookie")).not.toContain("hashed-test-token");
  });

  it.each([
    "type=recovery",
    "token_hash=hashed-test-token&type=email",
    "token_hash=hashed-test-token&type=signup",
  ])("rejects missing or unsupported confirmation parameters", async (query) => {
    const response = await GET(request(query));
    expect(response.headers.get("location")).toBe("/auth/login?recovery-error=1");
  });

  it("redirects safely when verification fails", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: new Error("expired") });
    const response = await GET(request("token_hash=expired-test-token&type=recovery"));
    expect(response.headers.get("location")).toBe("/auth/login?recovery-error=1");
    expect(await response.text()).not.toContain("expired-test-token");
  });

  it("blocks external and non-allowlisted next destinations", async () => {
    for (const next of ["https://attacker.example/reset", "//attacker.example/reset", "/admin"]) {
      const response = await GET(request(
        `token_hash=hashed-test-token&type=recovery&next=${encodeURIComponent(next)}`,
      ));
      expect(response.headers.get("location")).toBe("/auth/set-password");
    }
  });
});
