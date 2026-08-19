import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { logoutAction } from "@/app/auth/actions";
import { AdminActionButton } from "@/components/admin/admin-action-button";
import { AdminMobileNavigation } from "@/components/admin/admin-mobile-navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { LogoLockup } from "@/components/shared/logo-lockup";
import { getOptionalStaffSession } from "@/lib/auth/dal";

export const metadata: Metadata = { title: { default: "Vriksha Bandhan Campaign Desk", template: "%s | Vriksha Bandhan Campaign Desk" }, robots: { index: false, follow: false, nocache: true } };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getOptionalStaffSession();
  if (!session) redirect("/auth/login?next=/admin");
  return <div className="admin-shell">
    <a className="skip-link" href="#admin-main">Skip to desk content</a>
    <aside className="admin-sidebar">
      <div><LogoLockup variant="compact" /><p>Vriksha Bandhan Campaign Desk</p></div>
      <AdminNav session={session} />
      <footer><strong>{session.displayName}</strong><span>{session.role === "admin" ? "Admin" : "Reviewer"}</span><form action={logoutAction}><AdminActionButton label="Sign out" pendingLabel="Signing out…" /></form></footer>
    </aside>
    <AdminMobileNavigation session={session} />
    <main className="admin-main" id="admin-main">{children}</main>
  </div>;
}
