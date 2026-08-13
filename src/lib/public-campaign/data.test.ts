import { afterEach, describe, expect, it, vi } from "vitest";

import { getPublicCampaignSummary, getPublicMovementEntries } from "@/lib/public-campaign/data";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function environment() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
}

describe("safe public campaign data", () => {
  it("returns null rather than a fabricated count when disconnected", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    await expect(getPublicCampaignSummary()).resolves.toBeNull();
  });

  it("validates summary and builds only public Storage URLs", async () => {
    environment();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ current_count: 3, target_count: 983, metric_label: "Vriksha promises", submissions_open: true }])))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ guardian_number: 7, display_name: "Asha", published_at: "2026-08-11T12:51:02.536174+00:00", card_path: "card/7-v1.webp", card_width: 640, card_height: 800, full_path: "full/7-v1.webp", full_width: 1200, full_height: 900, alt_text: "A tree", focal_x: .5, focal_y: .5 }])));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getPublicCampaignSummary()).resolves.toMatchObject({ current_count: 3, target_count: 983 });
    const entries = await getPublicMovementEntries();
    expect(entries[0].published_at).toBe("2026-08-11T12:51:02.536174+00:00");
    expect(entries[0].card_url).toBe("https://project.supabase.co/storage/v1/object/public/published-images/card/7-v1.webp");
    expect(entries[0]).not.toHaveProperty("submission_id");
    expect(JSON.stringify(entries[0])).not.toContain("original");
  });
});
