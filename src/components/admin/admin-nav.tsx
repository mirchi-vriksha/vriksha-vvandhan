import Link from "next/link";
import { Archive, ClipboardList, Home, Send, Settings, ShieldCheck, Trash2, Users } from "lucide-react";

import type { StaffSession } from "@/lib/auth/types";

export function AdminNav({ session }: { session: StaffSession }) {
  const items = [
    { href: "/admin", label: "Overview", icon: Home },
    { href: "/admin/submissions?status=pending_review", label: "Submissions", icon: ClipboardList },
    ...(session.role === "admin" ? [{ href: "/admin/submissions?status=rejection_pending_admin", label: "Rejection Review", icon: ShieldCheck }] : []),
    { href: "/admin/submissions?status=published", label: "Published", icon: Archive },
    ...(session.role === "admin" ? [
      { href: "/admin/deliveries", label: "Deliveries", icon: Send },
      { href: "/admin/trash", label: "Trash", icon: Trash2 },
      { href: "/admin/team", label: "Team", icon: Users },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ] : []),
  ];
  return <nav className="admin-nav" aria-label="Vriksha Bandhan Campaign Desk"><ul>{items.map(({ href, label, icon: Icon }) => <li key={href}><Link href={href}><Icon size={18} aria-hidden="true" />{label}</Link></li>)}</ul></nav>;
}
