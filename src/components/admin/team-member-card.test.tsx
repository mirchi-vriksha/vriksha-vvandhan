import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/actions", () => ({
  manageStaffAction: vi.fn(),
  removeStaffAction: vi.fn(),
}));

import { TeamMemberCard } from "@/components/admin/team-member-card";

const profile = {
  id: "e2000000-0000-4000-8000-000000000001",
  display_name: "Asha Rao",
  role: "reviewer" as const,
  active: true,
  updated_at: "2026-08-18T10:00:00.000Z",
};

describe("TeamMemberCard", () => {
  it("keeps the member summary compact and puts controls in an edit disclosure", () => {
    render(
      <TeamMemberCard
        profile={profile}
        email="asha@example.com"
        isCurrentUser={false}
      />,
    );

    expect(screen.getByText("Asha Rao")).toBeVisible();
    expect(screen.getByText("asha@example.com")).toBeVisible();
    expect(screen.getByText("Active")).toBeVisible();
    expect(screen.getByText("Edit member").closest("details")).not.toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "Remove member" })).toBeEnabled();
  });

  it("protects the signed-in member from self-removal", () => {
    render(<TeamMemberCard profile={profile} email={null} isCurrentUser />);

    expect(screen.getByRole("button", { name: "Remove member" })).toBeDisabled();
    expect(screen.getByText("You cannot remove your own account.")).toBeInTheDocument();
  });
});
