import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/actions", () => ({
  createStaffAction: vi.fn(),
}));

import { CreateStaffForm } from "@/components/admin/create-staff-form";

describe("CreateStaffForm", () => {
  it("collects the account identity, initial password, role, and access state", () => {
    render(<CreateStaffForm />);

    expect(screen.getByLabelText("Display name")).toBeRequired();
    expect(screen.getByLabelText("Email address")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Initial password")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Initial password")).toHaveAttribute("minlength", "8");
    expect(screen.getByLabelText("Role")).toHaveValue("reviewer");
    expect(screen.getByLabelText("Allow this member to sign in now")).toBeChecked();
    expect(screen.getByRole("button", { name: "Add team member" })).toBeVisible();
  });
});
