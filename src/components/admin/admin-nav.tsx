"use client";

import Link from "next/link";
import { ClipboardList, Gauge, Send, Settings, Users } from "lucide-react";
import { usePathname } from "next/navigation";

import type { StaffSession } from "@/lib/auth/types";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: typeof Gauge;
  section: "workflow" | "admin";
};

export function getAdminNavItems(role: StaffSession["role"]): readonly AdminNavItem[] {
  return [
    { href: "/admin", label: "Dashboard", icon: Gauge, section: "workflow" },
    { href: "/admin/submissions?status=pending_review", label: "Review Queue", icon: ClipboardList, section: "workflow" },
    ...(role === "admin" ? [
      { href: "/admin/deliveries", label: "Deliveries", icon: Send, section: "admin" as const },
      { href: "/admin/team", label: "Team", icon: Users, section: "admin" as const },
      { href: "/admin/settings", label: "Campaign Settings", icon: Settings, section: "admin" as const },
    ] : []),
  ];
}

function isCurrent(pathname: string, href: string) {
  const itemPath = href.split("?")[0];
  return itemPath === "/admin" ? pathname === itemPath : pathname.startsWith(itemPath);
}

export function AdminNav({ session, onNavigate }: { session: StaffSession; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = getAdminNavItems(session.role);
  return <nav className="admin-nav" aria-label="Vriksha Bandhan Campaign Desk">
    <ul>
      {items.map(({ href, label, icon: Icon, section }, index) => <li key={href}>
        {section === "admin" && items[index - 1]?.section !== "admin" && <span className="admin-nav__section">Admin tools</span>}
        <Link href={href} aria-current={isCurrent(pathname, href) ? "page" : undefined} onClick={onNavigate}>
          <Icon size={18} aria-hidden="true" />{label}
        </Link>
      </li>)}
    </ul>
  </nav>;
}
