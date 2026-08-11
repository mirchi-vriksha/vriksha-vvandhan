import { describe, expect, it, vi } from "vitest";

import {
  applyRecoveryPasswordUpdate,
  GENERIC_RECOVERY_SENT_MESSAGE,
  recoveryRedirectUrl,
  safeRecoveryDestination,
  validatePasswordUpdate,
  validateRecoveryEmail,
  verifyRecoveryToken,
} from "@/lib/auth/password-recovery";

describe("staff password recovery helpers", () => {
  it("builds the hosted callback from the configured site origin", () => {
    expect(recoveryRedirectUrl("https://campaign.example/some-path")).toBe(
      "https://campaign.example/auth/confirm?next=%2Fauth%2Fset-password",
    );
  });

  it("accepts only the allowlisted recovery destination", () => {
    expect(safeRecoveryDestination("/auth/set-password")).toBe("/auth/set-password");
    expect(safeRecoveryDestination("https://attacker.example/reset")).toBe("/auth/set-password");
    expect(safeRecoveryDestination("//attacker.example/reset")).toBe("/auth/set-password");
    expect(safeRecoveryDestination("/admin")).toBe("/auth/set-password");
  });

  it("validates email without disclosing account or role state", () => {
    expect(validateRecoveryEmail(" Staff@Example.COM ")).toBe("staff@example.com");
    expect(validateRecoveryEmail("invalid-address")).toBeNull();
    expect(GENERIC_RECOVERY_SENT_MESSAGE).not.toMatch(/admin|reviewer|does not exist/i);
  });

  it("enforces the 8-character password and matching confirmation", () => {
    expect(validatePasswordUpdate("Seven77", "Seven77")).toBe("weak");
    expect(validatePasswordUpdate("Eight888", "Different8")).toBe("mismatch");
    expect(validatePasswordUpdate("Eight888", "Eight888")).toBe("valid");
  });

  it("verifies only token-hash recovery requests", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });
    const client = { auth: { verifyOtp } };

    await expect(verifyRecoveryToken(client, "hashed-test-token", "recovery")).resolves.toBe(true);
    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "hashed-test-token",
      type: "recovery",
    });

    verifyOtp.mockClear();
    await expect(verifyRecoveryToken(client, null, "recovery")).resolves.toBe(false);
    await expect(verifyRecoveryToken(client, "hashed-test-token", "email")).resolves.toBe(false);
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("updates the authenticated user and signs out only the local session", async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "staff-id" } }, error: null });
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const signOut = vi.fn().mockResolvedValue({ error: null });

    await expect(applyRecoveryPasswordUpdate(
      { auth: { getUser, updateUser, signOut } },
      "LongEnoughPass1",
    )).resolves.toEqual({ kind: "success" });
    expect(updateUser).toHaveBeenCalledWith({ password: "LongEnoughPass1" });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("does not update without a valid session and does not sign out after update failure", async () => {
    const updateUser = vi.fn();
    const signOut = vi.fn();
    await expect(applyRecoveryPasswordUpdate({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("invalid") }),
        updateUser,
        signOut,
      },
    }, "LongEnoughPass1")).resolves.toEqual({ kind: "no-session" });
    expect(updateUser).not.toHaveBeenCalled();

    await expect(applyRecoveryPasswordUpdate({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "staff-id" } }, error: null }),
        updateUser: vi.fn().mockResolvedValue({ error: new Error("temporary") }),
        signOut,
      },
    }, "LongEnoughPass1")).resolves.toEqual({ kind: "update-error" });
    expect(signOut).not.toHaveBeenCalled();
  });
});
