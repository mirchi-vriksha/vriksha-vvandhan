import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getPublicCampaignSummary } from "@/lib/public-campaign/data";

type LegalPageProps = {
  content: {
    eyebrow: string;
    title: string;
    intro: string;
    sections: readonly { title: string; body: string }[];
  };
};

export async function LegalPage({ content }: LegalPageProps) {
  const movementWallEnabled = (await getPublicCampaignSummary())?.movement_wall_enabled ?? false;

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <SiteHeader movementWallEnabled={movementWallEnabled} />
      <main className="legal-page" id="main-content">
        <article className="shell legal-page__article">
          <Link className="legal-page__back" href="/join"><ArrowLeft aria-hidden="true" size={17} /> Return to submission</Link>
          <p className="legal-page__eyebrow">{content.eyebrow}</p>
          <h1>{content.title}</h1>
          <p className="legal-page__intro">{content.intro}</p>
          <div className="legal-page__sections">
            {content.sections.map((section) => <section key={section.title}><h2>{section.title}</h2><p>{section.body}</p></section>)}
          </div>
        </article>
      </main>
      <SiteFooter movementWallEnabled={movementWallEnabled} />
    </>
  );
}
