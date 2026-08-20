import { describe, expect, it } from "vitest";

import { heroContent, heroPromiseImages } from "@/content/campaign";
import type { PublicMovementEntry } from "@/lib/public-campaign/data";
import {
  buildHomepageReel,
  HOMEPAGE_PUBLISHED_REEL_MINIMUM,
} from "@/lib/public-campaign/home-reel";

function movementEntry(guardianNumber: number): PublicMovementEntry {
  return {
    guardian_number: guardianNumber,
    display_name: `Guardian ${guardianNumber}`,
    published_at: "2026-08-18T08:00:00.000+00:00",
    card_path: `card/${guardianNumber}-v1.webp`,
    card_width: 640,
    card_height: 800,
    full_path: `full/${guardianNumber}-v1.webp`,
    full_width: 1280,
    full_height: 1600,
    alt_text: `Guardian ${guardianNumber} tying a Rakhi to a tree`,
    focal_x: 0.5,
    focal_y: 0.5,
    card_url: `https://project.supabase.co/storage/v1/object/public/published-images/card/${guardianNumber}-v1.webp`,
    full_url: `https://project.supabase.co/storage/v1/object/public/published-images/full/${guardianNumber}-v1.webp`,
  };
}

describe("buildHomepageReel", () => {
  it("keeps the clearly labelled curated reel below the published threshold", () => {
    const entries = Array.from(
      { length: HOMEPAGE_PUBLISHED_REEL_MINIMUM - 1 },
      (_, index) => movementEntry(index + 1),
    );

    expect(buildHomepageReel(entries)).toEqual({
      heading: heroContent.ribbonFallbackLabel,
      description: heroContent.ribbonFallbackDescription,
      images: heroPromiseImages,
      source: "curated",
    });
  });

  it("uses only approved public card images once six are available", () => {
    const entries = Array.from(
      { length: HOMEPAGE_PUBLISHED_REEL_MINIMUM },
      (_, index) => movementEntry(index + 1),
    );
    const reel = buildHomepageReel(entries);

    expect(reel.source).toBe("published");
    expect(reel.heading).toBe(heroContent.ribbonLabel);
    expect(reel.description).toBeNull();
    expect(reel.images).toHaveLength(HOMEPAGE_PUBLISHED_REEL_MINIMUM);
    expect(reel.images[0]).toEqual({
      id: "guardian-1",
      src: entries[0].card_url,
      width: 640,
      height: 800,
      alt: entries[0].alt_text,
      aspect: "portrait",
    });
    expect(reel.images.some((image) => image.src === entries[0].full_url)).toBe(false);
  });
});
