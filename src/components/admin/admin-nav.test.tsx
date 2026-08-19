import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminNav } from "@/components/admin/admin-nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));

const reviewer = { userId: "1", email: null, displayName: "Reviewer", role: "reviewer" as const };

describe("Campaign Desk navigation", () => {
  it("does not expose Admin-only destinations to Reviewers", () => {
    render(<AdminNav session={reviewer} />);
    expect(screen.queryByRole("link", { name: "Trash" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Team" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Campaign Settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Deliveries" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Review Queue" })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("shows Admin controls only to Admins", () => {
    render(<AdminNav session={{ ...reviewer, role: "admin" }} />);
    expect(screen.getByRole("link", { name: "Team" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Campaign Settings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Deliveries" })).toHaveAttribute("href", "/admin/deliveries");
    expect(screen.queryByRole("link", { name: "Trash" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Rejection Review" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });
});
