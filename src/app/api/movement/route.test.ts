import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEntries: vi.fn(),
  getSummary: vi.fn(),
}));

vi.mock("@/lib/public-campaign/data", () => ({
  getPublicMovementEntries: mocks.getEntries,
  getPublicCampaignSummary: mocks.getSummary,
}));

import { GET } from "@/app/api/movement/route";

describe("movement pagination route", () => {
  beforeEach(() => {
    mocks.getEntries.mockReset();
    mocks.getEntries.mockResolvedValue([]);
    mocks.getSummary.mockReset();
    mocks.getSummary.mockResolvedValue({ movement_wall_enabled: true });
  });

  it("returns not found when the public Movement Wall is disabled", async () => {
    mocks.getSummary.mockResolvedValue({ movement_wall_enabled: false });
    const response = await GET(new Request(
      "https://example.test/api/movement?beforePublishedAt=2026-08-11T12%3A51%3A02.536174%2B00%3A00&beforeGuardianNumber=3",
    ));
    expect(response.status).toBe(404);
    expect(mocks.getEntries).not.toHaveBeenCalled();
  });

  it("accepts the timezone-offset cursor returned by hosted Postgres", async () => {
    const publishedAt = "2026-08-11T12:51:02.536174+00:00";
    const response = await GET(new Request(
      `https://example.test/api/movement?beforePublishedAt=${encodeURIComponent(publishedAt)}&beforeGuardianNumber=3`,
    ));

    expect(response.status).toBe(200);
    expect(mocks.getEntries).toHaveBeenCalledWith({
      limit: 24,
      beforePublishedAt: publishedAt,
      beforeGuardianNumber: 3,
      cached: false,
    });
  });
});
