import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminMobileNavigation } from "@/components/admin/admin-mobile-navigation";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
vi.mock("@/app/auth/actions", () => ({ logoutAction: vi.fn() }));

const admin = { userId: "1", email: "admin@example.test", displayName: "Test Admin", role: "admin" as const };

describe("Campaign Desk mobile navigation", () => {
  it("traps the workflow in a labelled drawer and restores trigger focus on Escape", async () => {
    const user = userEvent.setup();
    render(<AdminMobileNavigation session={admin} />);

    const trigger = screen.getByRole("button", { name: "Open desk navigation" });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Campaign Desk navigation" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Review Queue" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Campaign Settings" })).toBeVisible();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Campaign Desk navigation" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes without restoring focus after choosing a destination", async () => {
    const user = userEvent.setup();
    render(<AdminMobileNavigation session={admin} />);
    await user.click(screen.getByRole("button", { name: "Open desk navigation" }));
    await user.click(screen.getByRole("link", { name: "Review Queue" }));
    expect(screen.queryByRole("dialog", { name: "Campaign Desk navigation" })).not.toBeInTheDocument();
  });
});
