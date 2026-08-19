import { heroContent, heroPromiseImages } from "@/content/campaign";
import type { PublicMovementEntry } from "@/lib/public-campaign/data";
import type { PromiseReelImage } from "@/types/campaign";

export const HOMEPAGE_PUBLISHED_REEL_MINIMUM = 6;

export type HomepageReel = {
  heading: string;
  description: string | null;
  images: readonly PromiseReelImage[];
  source: "curated" | "published";
};

function imageAspect(width: number, height: number): PromiseReelImage["aspect"] {
  const ratio = width / height;
  if (ratio < 0.9) return "portrait";
  if (ratio > 1.15) return "landscape";
  return "square";
}

export function buildHomepageReel(entries: readonly PublicMovementEntry[]): HomepageReel {
  if (entries.length < HOMEPAGE_PUBLISHED_REEL_MINIMUM) {
    return {
      heading: heroContent.ribbonFallbackLabel,
      description: heroContent.ribbonFallbackDescription,
      images: heroPromiseImages,
      source: "curated",
    };
  }

  return {
    heading: heroContent.ribbonLabel,
    description: null,
    images: entries.map((entry) => ({
      id: `guardian-${entry.guardian_number}`,
      src: entry.card_url,
      width: entry.card_width,
      height: entry.card_height,
      alt: entry.alt_text,
      aspect: imageAspect(entry.card_width, entry.card_height),
    })),
    source: "published",
  };
}
