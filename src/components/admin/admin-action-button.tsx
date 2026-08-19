"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

type AdminActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  pendingLabel: string;
};

export function AdminActionButton({
  label,
  pendingLabel,
  disabled = false,
  className,
  ...props
}: AdminActionButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      className={className}
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending ? <span className="admin-action-spinner" aria-hidden="true" /> : null}
      <span>{pending ? pendingLabel : label}</span>
    </button>
  );
}
