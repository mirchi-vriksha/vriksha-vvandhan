import type { Metadata } from "next";

import { CampaignGuide } from "@/components/home/campaign-guide";
import { CampaignHero } from "@/components/home/campaign-hero";
import { CampaignPromise } from "@/components/home/campaign-promise";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { JsonLd } from "@/components/shared/json-ld";
import { promiseMetric } from "@/content/campaign";
import { campaignFaqs } from "@/content/seo";
import { getPublicCampaignSummary, getPublicMovementEntries } from "@/lib/public-campaign/data";
import { buildHomepageReel } from "@/lib/public-campaign/home-reel";
import { absoluteUrl, organizationName, siteName } from "@/lib/seo";

const title = "Mirchi Vriksha Bandhan | Tie a Rakhi to a Tree";
const description =
  "Join Mirchi’s Vriksha Bandhan movement in Mumbai. Tie a Rakhi to a tree, share your moment and become a Vriksha Guardian this Raksha Bandhan.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/" },
  openGraph: { title, description, url: "/" },
  twitter: { title, description },
};

export default async function Home() {
  const [summary, movementEntries] = await Promise.all([
    getPublicCampaignSummary(),
    getPublicMovementEntries({ limit: 12 }).catch(() => []),
  ]);
  const metric = summary
    ? { current: summary.current_count, target: summary.target_count, label: promiseMetric.label }
    : promiseMetric;
  const reel = buildHomepageReel(movementEntries);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": absoluteUrl("/#organization"),
        name: organizationName,
        logo: { "@type": "ImageObject", url: absoluteUrl("/brand/mirchi-logo.png") },
      },
      {
        "@type": "WebSite",
        "@id": absoluteUrl("/#website"),
        url: absoluteUrl("/"),
        name: siteName,
        alternateName: "Vriksha Bandhan by Mirchi",
        inLanguage: "en-IN",
        publisher: { "@id": absoluteUrl("/#organization") },
        potentialAction: {
          "@type": "JoinAction",
          name: "Join Vriksha Bandhan",
          target: absoluteUrl("/join"),
        },
      },
      {
        "@type": "WebPage",
        "@id": absoluteUrl("/#webpage"),
        url: absoluteUrl("/"),
        name: title,
        description,
        isPartOf: { "@id": absoluteUrl("/#website") },
        about: ["Vriksha Bandhan", "Raksha Bandhan", "Tree protection", "Mumbai"],
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: absoluteUrl("/campaign/hero-tree-rakhi.webp"),
        },
      },
      {
        "@type": "FAQPage",
        "@id": absoluteUrl("/#faq"),
        mainEntity: campaignFaqs.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };
  return (
    <>
      <JsonLd data={jsonLd} />
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
        <CampaignGuide />
      </main>
      <SiteFooter movementWallEnabled={summary?.movement_wall_enabled ?? false} />
    </>
  );
}
