import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/public-campaign/data", () => ({
  getPublicCampaignSummary: vi.fn(),
}));

import manifest from "@/app/manifest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { getPublicCampaignSummary } from "@/lib/public-campaign/data";
import { absoluteUrl, serializeJsonLd, siteUrl } from "@/lib/seo";

const mockedSummary = vi.mocked(getPublicCampaignSummary);

describe("public SEO discovery", () => {
  beforeEach(() => {
    mockedSummary.mockResolvedValue(null);
  });

  it("keeps one stable production origin for canonical discovery", () => {
    expect(siteUrl).toBe("https://mirchivrikshabandhan.online");
    expect(absoluteUrl("/join")).toBe("https://mirchivrikshabandhan.online/join");
    expect(absoluteUrl("/#faq")).toBe("https://mirchivrikshabandhan.online/#faq");
  });

  it("allows public pages while protecting private and machine routes", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/auth/", "/vendor/"],
      },
      sitemap: "https://mirchivrikshabandhan.online/sitemap.xml",
      host: "https://mirchivrikshabandhan.online",
    });
  });

  it("only publishes live, indexable campaign pages in the sitemap", async () => {
    const routes = await sitemap();
    expect(routes.map((route) => route.url)).toEqual([
      "https://mirchivrikshabandhan.online/",
      "https://mirchivrikshabandhan.online/join",
    ]);

    mockedSummary.mockResolvedValue({
      current_count: 10,
      target_count: 983,
      metric_label: "trees celebrated",
      submissions_open: true,
      movement_wall_enabled: true,
    });
    expect((await sitemap()).map((route) => route.url)).toContain(
      "https://mirchivrikshabandhan.online/movement",
    );
  });

  it("publishes branded install metadata and safely serializes structured data", () => {
    expect(manifest()).toMatchObject({
      name: "Mirchi Vriksha Bandhan",
      start_url: "/",
      theme_color: "#173a2b",
      icons: [{ src: "/icon.png", sizes: "256x256", type: "image/png" }],
    });
    expect(serializeJsonLd({ text: "<tree>" })).toBe('{"text":"\\u003ctree>"}');
  });
});
