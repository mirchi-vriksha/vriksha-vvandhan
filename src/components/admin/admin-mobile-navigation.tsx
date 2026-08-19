"use client";

import { Menu, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { logoutAction } from "@/app/auth/actions";
import { AdminActionButton } from "@/components/admin/admin-action-button";
import { AdminNav } from "@/components/admin/admin-nav";
import { LogoLockup } from "@/components/shared/logo-lockup";
import type { StaffSession } from "@/lib/auth/types";

export function AdminMobileNavigation({ session }: { session: StaffSession }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback((restoreFocus = true) => {
    setIsOpen(false);
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("a[href]")?.focus(), 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, isOpen]);

  return <header className="admin-mobile-header">
    <LogoLockup variant="compact" />
    <div><strong>Campaign Desk</strong><span>{session.role === "admin" ? "Admin" : "Reviewer"}</span></div>
    <button ref={triggerRef} type="button" aria-label="Open desk navigation" aria-expanded={isOpen} aria-controls="admin-mobile-navigation" onClick={() => setIsOpen(true)}><Menu aria-hidden="true" size={22} /></button>
    {isOpen && <div className="admin-mobile-drawer__backdrop" onMouseDown={() => close()}>
      <div ref={panelRef} id="admin-mobile-navigation" className="admin-mobile-drawer" role="dialog" aria-modal="true" aria-label="Campaign Desk navigation" onMouseDown={(event) => event.stopPropagation()}>
        <div className="admin-mobile-drawer__heading"><div><p>Campaign Desk</p><strong>{session.displayName}</strong><span>{session.role === "admin" ? "Admin" : "Reviewer"}</span></div><button type="button" aria-label="Close desk navigation" onClick={() => close()}><X aria-hidden="true" size={22} /></button></div>
        <AdminNav session={session} onNavigate={() => close(false)} />
        <form action={logoutAction}><AdminActionButton className="admin-mobile-drawer__signout" label="Sign out" pendingLabel="Signing out…" /></form>
      </div>
    </div>}
  </header>;
}
