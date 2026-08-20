import { describe, expect, it } from "vitest";

import { createStaffMemberSchema } from "@/lib/auth/staff-management";

describe("createStaffMemberSchema", () => {
  it("normalizes staff identity fields without changing the password", () => {
    const parsed = createStaffMemberSchema.parse({
      displayName: "  Jay   Pandey  ",
      email: "  MEMBER@EXAMPLE.COM ",
      password: "  keep-spaces  ",
      role: "reviewer",
      active: true,
    });

    expect(parsed).toEqual({
      displayName: "Jay Pandey",
      email: "member@example.com",
      password: "  keep-spaces  ",
      role: "reviewer",
      active: true,
    });
  });

  it("rejects invalid roles and short passwords", () => {
    const base = {
      displayName: "Member",
      email: "member@example.com",
      password: "Eight888",
      role: "reviewer",
      active: true,
    };

    expect(createStaffMemberSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
    expect(createStaffMemberSchema.safeParse({ ...base, role: "owner" }).success).toBe(false);
  });
});
