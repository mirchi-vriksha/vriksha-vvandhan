type LoginRecoveryNoticeProps = {
  kind: "password-reset" | "recovery-error" | "recovery-required" | null;
};

export function LoginRecoveryNotice({ kind }: LoginRecoveryNoticeProps) {
  if (kind === "password-reset") {
    return (
      <div className="auth-success" role="status">
        Password updated. Sign in with your new password.
      </div>
    );
  }
  if (kind === "recovery-error") {
    return (
      <div className="auth-error" role="alert">
        This password reset link is invalid or has expired. Request a new one.
      </div>
    );
  }
  if (kind === "recovery-required") {
    return (
      <div className="auth-error" role="alert">
        A fresh password reset link is required before setting a new password.
      </div>
    );
  }
  return null;
}
