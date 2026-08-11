import { CampaignHero } from "@/components/home/campaign-hero";
import { CampaignPromise } from "@/components/home/campaign-promise";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { promiseMetric } from "@/content/campaign";
import { getPublicCampaignSummary } from "@/lib/public-campaign/data";

export default async function Home() {
  const summary = await getPublicCampaignSummary();
  const metric = summary
    ? { current: summary.current_count, target: summary.target_count, label: summary.metric_label }
    : promiseMetric;
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main-content">
        <CampaignHero metric={metric} />
        <CampaignPromise />
      </main>
      <SiteFooter />
    </>
  );
}
