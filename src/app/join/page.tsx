import type { Metadata } from "next";

import { PublicSubmissionForm } from "@/components/submission/public-submission-form";
import { SubmissionAvailability } from "@/components/submission/submission-availability";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { CampaignImage } from "@/components/shared/campaign-image";
import { hasServerSupabaseEnvironment } from "@/lib/env/server";
import {
  getPublicTurnstileConfiguration,
  TURNSTILE_WIDGET_ACTION,
} from "@/lib/security/turnstile.server";
import { getPublicSubmissionAvailability } from "@/lib/submissions/service.server";

export const metadata: Metadata = {
  title: "Join Vriksha Vvandhan | Mirchi",
  description: "Share one photograph for private review and make your promise to protect a tree visible.",
  alternates: { canonical: "/join" },
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

const joinImage = {
  src: "/campaign/child-hand-bark.webp",
  width: 560,
  height: 720,
  alt: "A child's hand resting gently on the bark of a tree",
  objectPosition: "50% 52%",
};

export default async function JoinPage() {
  let availability = hasServerSupabaseEnvironment()
    ? await getPublicSubmissionAvailability()
    : "unavailable";
  let turnstile = { enabled: false, siteKey: null as string | null };
  try {
    turnstile = getPublicTurnstileConfiguration();
  } catch {
    availability = "unavailable";
  }

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <SiteHeader />
      <main className="join-page" id="main-content">
        <section className="join-intro shell" aria-labelledby="join-title">
          <div className="join-intro__copy">
            <p className="join-intro__eyebrow">Join Vriksha Vvandhan</p>
            <h1 id="join-title">Make your promise visible.</h1>
            <p>Share one photograph to join the movement. Every submission is reviewed by the Mirchi team before it appears publicly.</p>
            <div className="join-trust"><span>Private upload</span><span>Human review</span><span>No public account</span></div>
          </div>
          <CampaignImage image={joinImage} sizes="(max-width: 767px) 92vw, 38vw" className="join-intro__image" preload />
        </section>
        <div className="join-form-shell shell">
          {availability === "open" ? (
            <PublicSubmissionForm turnstile={{ ...turnstile, action: TURNSTILE_WIDGET_ACTION }} />
          ) : <SubmissionAvailability state={availability} />}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
