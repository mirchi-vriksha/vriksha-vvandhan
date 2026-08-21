import type { Metadata } from "next";

import { JoinCampaignOverview } from "@/components/join/campaign-overview";
import { PublicSubmissionForm } from "@/components/submission/public-submission-form";
import { SubmissionAvailability } from "@/components/submission/submission-availability";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { JsonLd } from "@/components/shared/json-ld";
import { hasServerSupabaseEnvironment } from "@/lib/env/server";
import {
  getPublicTurnstileConfiguration,
  TURNSTILE_WIDGET_ACTION,
} from "@/lib/security/turnstile.server";
import { getPublicSubmissionAvailability } from "@/lib/submissions/service.server";
import { getPublicCampaignSummary } from "@/lib/public-campaign/data";
import { absoluteUrl } from "@/lib/seo";

const title = "Join Mirchi Vriksha Bandhan | Tie a Rakhi to a Tree";
const description =
  "Tie a Rakhi to a tree in Mumbai, upload your Vriksha Bandhan moment and become a Vriksha Guardian with a personalised certificate.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/join" },
  openGraph: {
    title,
    description,
    url: "/join",
  },
  twitter: {
    title,
    description,
  },
};

export const dynamic = "force-dynamic";

export default async function JoinPage() {
  const summary = await getPublicCampaignSummary();
  let availability = hasServerSupabaseEnvironment()
    ? await getPublicSubmissionAvailability()
    : "unavailable";
  let turnstile = { enabled: false, siteKey: null as string | null };
  try {
    turnstile = getPublicTurnstileConfiguration();
  } catch {
    availability = "unavailable";
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Vriksha Bandhan", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Join", item: absoluteUrl("/join") },
        ],
      },
      {
        "@type": "HowTo",
        name: "How to join Mirchi Vriksha Bandhan",
        description,
        totalTime: "PT10M",
        step: [
          "Register and get your Rakhi",
          "Choose a tree to celebrate",
          "Tie the Rakhi gently without harming the tree",
          "Take a clear photograph of your Vriksha Bandhan moment",
          "Upload the photograph for review",
        ].map((name, index) => ({
          "@type": "HowToStep",
          position: index + 1,
          name,
          url: absoluteUrl(`/join#how-to-participate`),
        })),
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <SiteHeader movementWallEnabled={summary?.movement_wall_enabled ?? false} />
      <main className="join-page" id="main-content">
        <section className="join-intro shell" aria-labelledby="join-title">
          <p className="join-intro__eyebrow">Become a Vriksha Guardian</p>
          <h1 id="join-title">Turn Gratitude Into a Green Bond.</h1>
          <p>
            Tie a Rakhi to a tree, share your moment and become a Vriksha Guardian—someone who
            chose to celebrate the bond between us and nature.
          </p>
        </section>
        <div className="join-content shell">
          <JoinCampaignOverview />
          <section className="join-submission" aria-labelledby="join-submission-title">
            <h2 className="join-section-label" id="join-submission-title">Your submission</h2>
            {availability === "open" ? (
              <>
                <p className="join-submission__instructions" id="submission-instructions">
                  Upload a clear photograph of your Vriksha Bandhan moment. If approved, you’ll
                  receive a Vriksha Guardian number and personalised certificate.
                </p>
                <PublicSubmissionForm
                  instructionsId="submission-instructions"
                  turnstile={{ ...turnstile, action: TURNSTILE_WIDGET_ACTION }}
                />
              </>
            ) : <SubmissionAvailability state={availability} />}
          </section>
        </div>
      </main>
      <SiteFooter movementWallEnabled={summary?.movement_wall_enabled ?? false} />
    </>
  );
}
