import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/auth/actions", () => ({
  forgotPasswordAction: vi.fn(),
  setPasswordAction: vi.fn(),
}));

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { LoginRecoveryNotice } from "@/components/auth/login-recovery-notice";
import { SetPasswordForm } from "@/components/auth/set-password-form";

describe("password recovery UI", () => {
  it("renders the email-only reset request form", () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText("Email address")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Email address")).toBeRequired();
    expect(screen.getByRole("button", { name: "Send password reset link" })).toBeVisible();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it("renders matching new-password fields with the hardened minimum", () => {
    render(<SetPasswordForm />);
    expect(screen.getByLabelText("New password")).toHaveAttribute("minlength", "8");
    expect(screen.getByLabelText("Confirm new password")).toHaveAttribute("minlength", "8");
    expect(screen.getByRole("button", { name: "Update password" })).toBeVisible();
  });

  it("renders safe login recovery states without technical details", () => {
    const { rerender } = render(<LoginRecoveryNotice kind="password-reset" />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Password updated. Sign in with your new password.",
    );

    rerender(<LoginRecoveryNotice kind="recovery-error" />);
    expect(screen.getByRole("alert")).toHaveTextContent("invalid or has expired");

    rerender(<LoginRecoveryNotice kind="recovery-required" />);
    expect(screen.getByRole("alert")).toHaveTextContent("fresh password reset link");
  });
});
