import { HeroBrandMasthead } from "@/components/home/hero-brand-masthead";
import { HeroActions } from "@/components/home/hero-actions";
import { HeroMedia } from "@/components/home/hero-media";
import { PromiseRibbon } from "@/components/home/promise-ribbon";
import { RakhiPromiseCounter } from "@/components/home/rakhi-promise-counter";
import { heroContent, heroPromiseImages, promiseMetric } from "@/content/campaign";
import type { CampaignMetric, PromiseReelImage } from "@/types/campaign";

type CampaignHeroProps = {
  metric?: CampaignMetric;
  reelImages?: readonly PromiseReelImage[];
  ribbonDescription?: string | null;
  ribbonHeading?: string;
};

function BotanicalDetail({ side }: { side: "left" | "right" }) {
  return (
    <svg
      className={`campaign-hero__botanical campaign-hero__botanical--${side}`}
      viewBox="0 0 320 500"
      aria-hidden="true"
    >
      <path d="M300 18C218 115 203 219 202 477" />
      <path d="M253 87c-47 2-79 20-104 52 45 5 79-10 104-52Z" />
      <path d="M226 174c44-3 76 11 98 42-43 8-76-5-98-42Z" />
      <path d="M205 250c-43 2-75 18-98 49 43 7 75-8 98-49Z" />
      <path d="M202 329c42-1 75 14 100 44-42 9-76-4-100-44Z" />
      <path d="M200 401c-39 4-67 19-88 47 39 5 68-9 88-47Z" />
    </svg>
  );
}

export function CampaignHero({
  metric = promiseMetric,
  reelImages = heroPromiseImages,
  ribbonDescription = heroContent.ribbonFallbackDescription,
  ribbonHeading = heroContent.ribbonFallbackLabel,
}: CampaignHeroProps) {
  return (
    <section className="campaign-hero" id="movement" aria-labelledby="campaign-title">
      <BotanicalDetail side="left" />
      <BotanicalDetail side="right" />
      <div className="shell campaign-hero__inner">
        <div className="campaign-hero__stage">
          <HeroBrandMasthead />
          <div className="campaign-hero__identity">
            <h1 id="campaign-title">
              <span>Vriksha</span>
              {" "}
              <span>Bandhan</span>
            </h1>
            <p className="campaign-hero__tagline">{heroContent.tagline}</p>
          </div>
          <HeroMedia />
          <div className="campaign-hero__engagement">
            <RakhiPromiseCounter metric={metric} />
            <HeroActions primary={heroContent.primaryCta} />
          </div>
        </div>
        <PromiseRibbon
          description={ribbonDescription}
          heading={ribbonHeading}
          images={reelImages}
        />
      </div>
    </section>
  );
}
