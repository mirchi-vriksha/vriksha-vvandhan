import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env/server", () => ({ hasServerSupabaseEnvironment: () => true }));
vi.mock("@/lib/security/turnstile.server", () => ({
  getPublicTurnstileConfiguration: () => ({ enabled: false, siteKey: null }),
  TURNSTILE_WIDGET_ACTION: "public_submission_prepare",
}));
vi.mock("@/lib/submissions/service.server", () => ({
  getPublicSubmissionAvailability: () => Promise.resolve("open"),
}));

import JoinPage from "@/app/join/page";

describe("Vriksha Bandhan join page", () => {
  it("keeps the approved explanation compact and the instructions before the unchanged form", async () => {
    const { container } = render(await JoinPage());

    expect(screen.getByRole("heading", { level: 1, name: "Tie a Rakhi to a Tree" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "About Vriksha Bandhan" })).toBeInTheDocument();
    expect(screen.getByText("983 Trees. 983 Promises. One Greener Mumbai.")).toBeInTheDocument();
    expect(container.querySelectorAll("#how-to-participate li")).toHaveLength(5);
    expect(screen.getByText("Upload & inspire others")).toBeInTheDocument();

    const instructions = screen.getByText(/Upload a clear photograph of your Rakhi tied to a tree/);
    const form = container.querySelector("form.public-submission-form");
    expect(form).not.toBeNull();
    expect(instructions.compareDocumentPosition(form!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(form).toHaveAttribute("aria-describedby", "submission-instructions");

    expect(screen.getByLabelText("Display name")).toBeRequired();
    expect(screen.getByLabelText("Email address")).toBeRequired();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(container.querySelector('[name="treeName"], [name="location"], [name="story"], [name="phone"]')).toBeNull();
  });
});
