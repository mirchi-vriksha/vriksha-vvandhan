import type { MetadataRoute } from "next";

import { getPublicCampaignSummary } from "@/lib/public-campaign/data";
import { absoluteUrl } from "@/lib/seo";

const lastContentUpdate = new Date("2026-08-21T00:00:00+05:30");

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const summary = await getPublicCampaignSummary();
  const routes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified: lastContentUpdate,
      changeFrequency: "weekly",
      priority: 1,
      images: [
        absoluteUrl("/campaign/hero-tree-rakhi.webp"),
        absoluteUrl("/campaign/movement-rakhi-wide.webp"),
      ],
    },
    {
      url: absoluteUrl("/join"),
      lastModified: lastContentUpdate,
      changeFrequency: "weekly",
      priority: 0.9,
      images: [absoluteUrl("/campaign/guardian-preview.webp")],
    },
  ];

  if (summary?.movement_wall_enabled) {
    routes.push({
      url: absoluteUrl("/movement"),
      lastModified: lastContentUpdate,
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  return routes;
}
