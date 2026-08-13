import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MovementWall } from "@/components/movement/movement-wall";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getPublicCampaignSummary, getPublicMovementEntries } from "@/lib/public-campaign/data";

export const metadata: Metadata = {
  title: "A Wall of Gratitude | Vriksha Bandhan",
  description: "Every Rakhi tells a story on Mumbai’s growing Wall of Gratitude.",
  alternates: { canonical: "/movement" },
  openGraph: {
    title: "A Wall of Gratitude | Vriksha Bandhan",
    description: "Every picture celebrates a bond on Mumbai’s growing Wall of Gratitude.",
    url: "/movement",
  },
  twitter: {
    title: "A Wall of Gratitude | Vriksha Bandhan",
    description: "Every picture celebrates a bond on Mumbai’s growing Wall of Gratitude.",
  },
};

export default async function MovementPage() {
  const [summary, entries] = await Promise.all([
    getPublicCampaignSummary(),
    getPublicMovementEntries({ limit: 24 }).catch(() => []),
  ]);
  if (!summary?.movement_wall_enabled) notFound();
  return (
    <>
      <a className="skip-link" href="#movement-wall">Skip to movement wall</a>
      <SiteHeader movementWallEnabled />
      <main className="movement-page" id="movement-wall">
        <header className="shell movement-page__header">
          <p>Movement Wall</p>
          <h1>A Wall of Gratitude</h1>
          <div className="movement-page__intro">
            <span>Every Rakhi tells a story.</span>
            <span>Every picture celebrates a bond.</span>
            <span>Together, they create Mumbai’s growing wall of gratitude.</span>
          </div>
          <div className="movement-page__count" aria-label={summary ? `${summary.current_count} of ${summary.target_count} trees celebrated` : "Campaign tracker updating"}>
            <strong>{summary?.current_count ?? "—"}</strong><span>/ {summary?.target_count ?? 983}</span>
            <small>{summary ? "trees celebrated" : "Tracker updating"}</small>
          </div>
        </header>
        <section className="shell" aria-label="Approved Vriksha Bandhan moments">
          <MovementWall initialEntries={entries} />
        </section>
      </main>
      <SiteFooter movementWallEnabled />
    </>
  );
}
