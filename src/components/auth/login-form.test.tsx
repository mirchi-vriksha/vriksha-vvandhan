import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useFormStatus: vi.fn(),
}));

vi.mock("react-dom", () => ({
  useFormStatus: mocks.useFormStatus,
}));
vi.mock("@/app/auth/actions", () => ({
  loginAction: vi.fn(),
}));

import { LoginForm } from "@/components/auth/login-form";

describe("LoginForm", () => {
  beforeEach(() => mocks.useFormStatus.mockReturnValue({ pending: false }));

  it("renders the secure staff credentials form", () => {
    render(<LoginForm next="/admin" />);
    expect(screen.getByLabelText("Email address")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("button", { name: "Sign in securely" })).toBeEnabled();
  });

  it("shows immediate progress and prevents duplicate sign-in attempts", () => {
    mocks.useFormStatus.mockReturnValue({ pending: true });
    render(<LoginForm next="/admin" />);
    const button = screen.getByRole("button", { name: "Signing in…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector(".admin-action-spinner")).not.toBeNull();
  });
});
