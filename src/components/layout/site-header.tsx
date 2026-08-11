import Link from "next/link";

import { navigationItems } from "@/content/campaign";
import { LogoLockup } from "@/components/shared/logo-lockup";
import { MobileNavigation } from "@/components/layout/mobile-navigation";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner shell">
        <Link className="site-header__brand" href="/" aria-label="Vriksha Bandhan home">
          <LogoLockup variant="compact" />
        </Link>
        <nav className="site-header__desktop-nav" aria-label="Primary navigation">
          <ul>
            {navigationItems.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>
          <a className="button button--primary button--small" href="/join">
            Tie a Rakhi to a Tree
          </a>
        </nav>
        <MobileNavigation items={navigationItems} />
      </div>
    </header>
  );
}
