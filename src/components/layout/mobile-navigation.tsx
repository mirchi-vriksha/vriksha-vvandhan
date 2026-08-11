"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

import type { NavigationItem } from "@/types/campaign";

type MobileNavigationProps = {
  items: readonly NavigationItem[];
};

export function MobileNavigation({ items }: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  const closeMenu = useCallback(({ restoreFocus = true } = {}) => {
    setIsOpen(false);
    if (restoreFocus) {
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => firstLinkRef.current?.focus(), 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
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

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, isOpen]);

  return (
    <div className="mobile-navigation">
      <button
        ref={triggerRef}
        type="button"
        className="mobile-navigation__trigger"
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
        aria-controls="mobile-navigation-panel"
        onClick={() => setIsOpen(true)}
      >
        <Menu aria-hidden="true" size={22} />
      </button>

      {isOpen ? (
        <div className="mobile-navigation__backdrop" onMouseDown={() => closeMenu()}>
          <div
            ref={panelRef}
            id="mobile-navigation-panel"
            className="mobile-navigation__panel"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mobile-navigation__topline">
              <p>Explore the campaign</p>
              <button
                type="button"
                className="mobile-navigation__close"
                aria-label="Close navigation menu"
                onClick={() => closeMenu()}
              >
                <X aria-hidden="true" size={22} />
              </button>
            </div>
            <nav aria-label="Mobile navigation">
              <ul className="mobile-navigation__list">
                {items.map((item, index) => (
                  <li key={item.href}>
                    <a
                      ref={index === 0 ? firstLinkRef : undefined}
                      href={item.href}
                      onClick={() => closeMenu({ restoreFocus: false })}
                    >
                      <span aria-hidden="true">0{index + 1}</span>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <a
              href="/join"
              className="button button--primary mobile-navigation__cta"
              onClick={() => closeMenu({ restoreFocus: false })}
            >
              Tie a Rakhi to a Tree
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
