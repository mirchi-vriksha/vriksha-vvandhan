import { beforeEach, describe, expect, it, vi } from "vitest";

const id = "00000000-0000-4000-8000-000000000001";
const originalPath = `${id}/original.webp`;
const thumbnailPath = `${id}/review-thumb.webp`;

const mocks = vi.hoisted(() => ({
  createOriginalReviewUrl: vi.fn(),
  createReviewThumbnailUrls: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/auth/dal", () => ({
  requireStaff: () => Promise.resolve({ role: "reviewer" }),
}));

vi.mock("@/lib/storage/signed-review-url.server", () => ({
  createOriginalReviewUrl: mocks.createOriginalReviewUrl,
  createReviewThumbnailUrls: mocks.createReviewThumbnailUrls,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => Promise.resolve({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.maybeSingle }),
      }),
    }),
  }),
}));

vi.mock("@/lib/testing/staff-adapter", () => ({
  isStaffE2EAdapterEnabled: () => false,
}));

import { getSubmissionDetail } from "@/lib/moderation/data.server";

const record = {
  id,
  submission_media: {
    original_path: originalPath,
    review_thumbnail_path: thumbnailPath,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.maybeSingle.mockResolvedValue({ data: record, error: null });
});

describe("submission detail private review image", () => {
  it("signs the stored original for the full-size detail review", async () => {
    mocks.createOriginalReviewUrl.mockResolvedValue({
      bucket: "submission-originals",
      path: originalPath,
      signedUrl: "https://private.test/original",
      expiresIn: 600,
    });

    const result = await getSubmissionDetail(id);

    expect(mocks.createOriginalReviewUrl).toHaveBeenCalledWith(originalPath);
    expect(mocks.createReviewThumbnailUrls).not.toHaveBeenCalled();
    expect(result?.reviewImage).toMatchObject({
      path: originalPath,
      signedUrl: "https://private.test/original",
      source: "original",
    });
  });

  it("falls back to the private thumbnail if original signing is unavailable", async () => {
    mocks.createOriginalReviewUrl.mockRejectedValue(new Error("temporary signing failure"));
    mocks.createReviewThumbnailUrls.mockResolvedValue(new Map([
      [thumbnailPath, "https://private.test/thumbnail"],
    ]));

    const result = await getSubmissionDetail(id);

    expect(mocks.createReviewThumbnailUrls).toHaveBeenCalledWith([thumbnailPath]);
    expect(result?.reviewImage).toMatchObject({
      path: thumbnailPath,
      signedUrl: "https://private.test/thumbnail",
      source: "thumbnail",
    });
  });
});
