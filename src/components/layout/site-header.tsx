import Link from "next/link";

import { navigationItems } from "@/content/campaign";
import { LogoLockup } from "@/components/shared/logo-lockup";
import { MobileNavigation } from "@/components/layout/mobile-navigation";

export function SiteHeader({ movementWallEnabled = false }: { movementWallEnabled?: boolean }) {
  const visibleNavigationItems = navigationItems.filter(
    (item) => movementWallEnabled || item.href !== "/movement",
  );
  return (
    <header className="site-header">
      <div className="site-header__inner shell">
        <Link className="site-header__brand" href="/" aria-label="Vriksha Bandhan home">
          <LogoLockup variant="compact" />
        </Link>
        <nav className="site-header__desktop-nav" aria-label="Primary navigation">
          <ul>
            {visibleNavigationItems.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>
          <a className="button button--primary button--small" href="/join">
            Tie a Rakhi to a Tree
          </a>
        </nav>
        <MobileNavigation items={visibleNavigationItems} />
      </div>
    </header>
  );
}
