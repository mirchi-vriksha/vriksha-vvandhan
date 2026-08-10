import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class VerificationError extends Error {
    constructor(public readonly kind: "invalid" | "transient") {
      super(kind);
    }
  }
  return {
    VerificationError,
    verify: vi.fn(),
    generateThumbnail: vi.fn(),
    uploadThumbnail: vi.fn(),
    createSignedUpload: vi.fn(),
    remove: vi.fn(),
    list: vi.fn(),
    maybeSingle: vi.fn(),
    rpc: vi.fn(),
    deleteEq: vi.fn(),
  };
});

function queryBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: mocks.maybeSingle,
    then: undefined,
  };
  return builder;
}

let submissionsQuery = queryBuilder();

vi.mock("@/lib/supabase/service", () => ({
  getServiceSupabaseClient: () => ({
    from: () => submissionsQuery,
    rpc: mocks.rpc,
    storage: { from: () => ({ list: mocks.list, remove: mocks.remove }) },
  }),
}));
vi.mock("@/lib/storage/signed-upload.server", () => ({
  createOriginalSignedUpload: mocks.createSignedUpload,
}));
vi.mock("@/lib/submissions/verify-uploaded-image.server", () => ({
  UploadedImageVerificationError: mocks.VerificationError,
  verifyUploadedImage: mocks.verify,
}));
vi.mock("@/lib/storage/review-thumbnail.server", () => ({
  generateReviewThumbnail: mocks.generateThumbnail,
  uploadReviewThumbnail: mocks.uploadThumbnail,
}));

import {
  finalizePublicSubmission,
  preparePublicSubmission,
  SubmissionServiceError,
} from "@/lib/submissions/service.server";

const input = {
  submissionId: "00000000-0000-4000-8000-000000000001",
  requestToken: "a".repeat(64),
};

beforeEach(() => {
  vi.clearAllMocks();
  submissionsQuery = queryBuilder();
  mocks.maybeSingle.mockResolvedValue({
    data: {
      id: input.submissionId,
      status: "draft",
      draft_expires_at: new Date(Date.now() + 60_000).toISOString(),
      submission_media: { original_path: `${input.submissionId}/original.webp` },
    },
    error: null,
  });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.list.mockResolvedValue({ data: [], error: null });
  mocks.createSignedUpload.mockResolvedValue({
    bucket: "submission-originals",
    path: `${input.submissionId}/original.jpg`,
    token: "signed-upload-token",
  });
  mocks.verify.mockResolvedValue({
    data: Buffer.from([1, 2, 3]),
    mimeType: "image/webp",
    bytes: 3,
    width: 640,
    height: 800,
    sha256: "a".repeat(64),
  });
  mocks.generateThumbnail.mockResolvedValue({
    buffer: Buffer.from([4, 5]),
    mimeType: "image/webp",
    width: 240,
    height: 300,
    bytes: 2,
  });
  mocks.uploadThumbnail.mockResolvedValue({
    path: `${input.submissionId}/review-thumb.webp`,
    generatedAt: "2026-08-07T04:00:00.000Z",
  });
  mocks.rpc.mockResolvedValue({
    data: [{ submission_id: input.submissionId, status: "pending_review" }],
    error: null,
  });
});

describe("submission preparation", () => {
  it("accepts the timezone-offset timestamp returned by hosted Postgres", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.rpc.mockResolvedValue({
      data: [{
        submission_id: input.submissionId,
        status: "draft",
        original_path: `${input.submissionId}/original.jpg`,
        original_extension: "jpg",
        draft_expires_at: "2026-08-11T09:30:00+00:00",
      }],
      error: null,
    });

    await expect(preparePublicSubmission({
      displayName: "Staging test",
      email: "staging@example.invalid",
      publicationConsent: true,
      termsAccepted: true,
      requestToken: input.requestToken,
      preparedExtension: "jpg",
    })).resolves.toMatchObject({
      submissionId: input.submissionId,
      status: "draft",
      draftExpiresAt: "2026-08-11T09:30:00+00:00",
      uploadRequired: true,
    });
  });
});

describe("submission finalisation retry safety", () => {
  it("removes an invalid object and its Draft without exposing Storage details", async () => {
    mocks.verify.mockRejectedValue(new mocks.VerificationError("invalid"));

    await expect(finalizePublicSubmission(input)).rejects.toEqual(
      expect.objectContaining<Partial<SubmissionServiceError>>({ code: "invalid_image" }),
    );
    expect(mocks.remove).toHaveBeenCalledWith([`${input.submissionId}/original.webp`]);
    expect(submissionsQuery.delete).toHaveBeenCalledOnce();
  });

  it("keeps the Draft and object on a transient verification failure for retry", async () => {
    mocks.verify.mockRejectedValue(new mocks.VerificationError("transient"));

    await expect(finalizePublicSubmission(input)).rejects.toEqual(
      expect.objectContaining<Partial<SubmissionServiceError>>({ code: "media_not_ready" }),
    );
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(submissionsQuery.delete).not.toHaveBeenCalled();
  });

  it("returns success idempotently when the matching submission is already Pending Review", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: input.submissionId,
        status: "pending_review",
        draft_expires_at: null,
        submission_media: { original_path: `${input.submissionId}/original.webp` },
      },
      error: null,
    });

    await expect(finalizePublicSubmission(input)).resolves.toEqual({
      success: true,
      status: "pending_review",
    });
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("stores trusted thumbnail metadata in the atomic finalisation call", async () => {
    await expect(finalizePublicSubmission(input)).resolves.toEqual({
      success: true,
      status: "pending_review",
    });

    expect(mocks.generateThumbnail).toHaveBeenCalledWith(Buffer.from([1, 2, 3]));
    expect(mocks.uploadThumbnail).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith(
      "finalize_public_submission_with_review_thumbnail",
      expect.objectContaining({
        p_review_thumbnail_path: `${input.submissionId}/review-thumb.webp`,
        p_review_thumbnail_width: 240,
        p_review_thumbnail_height: 300,
        p_review_thumbnail_bytes: 2,
      }),
    );
  });

  it("still enters Pending Review when thumbnail generation fails transiently", async () => {
    mocks.generateThumbnail.mockRejectedValue(new Error("temporary image worker failure"));

    await expect(finalizePublicSubmission(input)).resolves.toEqual({
      success: true,
      status: "pending_review",
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "finalize_public_submission_with_review_thumbnail",
      expect.objectContaining({
        p_review_thumbnail_path: null,
        p_review_thumbnail_width: null,
        p_review_thumbnail_height: null,
        p_review_thumbnail_bytes: null,
        p_review_thumbnail_generated_at: null,
      }),
    );
  });
});
