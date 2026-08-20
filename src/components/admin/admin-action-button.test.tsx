import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useFormStatus: vi.fn(),
}));

vi.mock("react-dom", async () => ({
  ...(await vi.importActual<typeof import("react-dom")>("react-dom")),
  useFormStatus: mocks.useFormStatus,
}));

import { AdminActionButton } from "@/components/admin/admin-action-button";

describe("AdminActionButton", () => {
  beforeEach(() => mocks.useFormStatus.mockReturnValue({ pending: false }));

  it("shows the normal action label while idle", () => {
    render(<form><AdminActionButton label="Approve and publish" pendingLabel="Approving and sending…" /></form>);
    expect(screen.getByRole("button", { name: "Approve and publish" })).toBeEnabled();
  });

  it("disables the action and gives immediate progress feedback while pending", () => {
    mocks.useFormStatus.mockReturnValue({ pending: true });
    render(<form><AdminActionButton label="Approve and publish" pendingLabel="Approving and sending…" /></form>);
    const button = screen.getByRole("button", { name: "Approving and sending…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector(".admin-action-spinner")).not.toBeNull();
  });
});
