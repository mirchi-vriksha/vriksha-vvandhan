import { CampaignHero } from "@/components/home/campaign-hero";
import { CampaignPromise } from "@/components/home/campaign-promise";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { promiseMetric } from "@/content/campaign";
import { getPublicCampaignSummary, getPublicMovementEntries } from "@/lib/public-campaign/data";
import { buildHomepageReel } from "@/lib/public-campaign/home-reel";

export default async function Home() {
  const [summary, movementEntries] = await Promise.all([
    getPublicCampaignSummary(),
    getPublicMovementEntries({ limit: 12 }).catch(() => []),
  ]);
  const metric = summary
    ? { current: summary.current_count, target: summary.target_count, label: promiseMetric.label }
    : promiseMetric;
  const reel = buildHomepageReel(movementEntries);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <SiteHeader movementWallEnabled={summary?.movement_wall_enabled ?? false} />
      <main id="main-content">
        <CampaignHero
          metric={metric}
          reelImages={reel.images}
          ribbonDescription={reel.description}
          ribbonHeading={reel.heading}
        />
        <CampaignPromise movementWallEnabled={summary?.movement_wall_enabled ?? false} />
      </main>
      <SiteFooter movementWallEnabled={summary?.movement_wall_enabled ?? false} />
    </>
  );
}
