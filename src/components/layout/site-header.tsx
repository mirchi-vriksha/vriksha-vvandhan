import Link from "next/link";

import { navigationItems } from "@/content/campaign";
import { LogoLockup } from "@/components/shared/logo-lockup";
import { MobileNavigation } from "@/components/layout/mobile-navigation";
import { getPublicCampaignSummary } from "@/lib/public-campaign/data";

export async function SiteHeader({ movementWallEnabled }: { movementWallEnabled?: boolean }) {
  const enabled = movementWallEnabled ?? (await getPublicCampaignSummary())?.movement_wall_enabled ?? false;
  const visibleNavigationItems = navigationItems.filter(
    (item) => enabled || item.href !== "/movement",
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
