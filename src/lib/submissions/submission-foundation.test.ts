import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const imageCompression = vi.fn();
vi.mock("browser-image-compression", () => ({ default: imageCompression }));

import { toPublicApiError, mapDatabaseError } from "@/lib/submissions/api-errors";
import {
  ClientImageError,
  prepareImage,
  revokePreviewUrl,
  validateImageInput,
} from "@/lib/submissions/client-image";
import { isSameOriginRequest } from "@/lib/submissions/origin.server";
import { generatePublicRequestToken } from "@/lib/submissions/request-token";
import { hashPublicRequestToken } from "@/lib/submissions/request-token.server";
import {
  consentSchema,
  displayNameSchema,
  emailSchema,
  prepareSubmissionResponseSchema,
  prepareSubmissionRequestSchema,
  storageDescriptorSchema,
} from "@/lib/submissions/schemas";

const originalWorker = globalThis.Worker;

beforeEach(() => {
  vi.stubGlobal("Worker", undefined);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/webp;base64,");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalWorker) vi.stubGlobal("Worker", originalWorker);
});

describe("public submission validation", () => {
  it("normalises Unicode-safe display names and email addresses", () => {
    expect(displayNameSchema.parse("  Jay   पांडे  ")).toBe("Jay पांडे");
    expect(emailSchema.parse("  Person@Example.COM ")).toBe("person@example.com");
    expect(displayNameSchema.safeParse("   ").success).toBe(false);
    expect(displayNameSchema.safeParse("x".repeat(101)).success).toBe(false);
  });

  it("requires both unchecked-by-default consent values to become true", () => {
    expect(consentSchema.safeParse({ publicationConsent: false, termsAccepted: true }).success).toBe(false);
    expect(consentSchema.safeParse({ publicationConsent: true, termsAccepted: true }).success).toBe(true);
  });

  it("accepts only the five public fields plus system-generated workflow values", () => {
    const base = {
      displayName: "Participant",
      email: "participant@example.com",
      publicationConsent: true,
      termsAccepted: true,
      requestToken: "a".repeat(64),
      preparedExtension: "webp",
    };
    expect(prepareSubmissionRequestSchema.safeParse(base).success).toBe(true);
    expect(prepareSubmissionRequestSchema.safeParse({ ...base, city: "Mumbai" }).success).toBe(false);
  });

  it("generates random 256-bit tokens and hashes them only on the server", () => {
    const first = generatePublicRequestToken();
    const second = generatePublicRequestToken();
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).not.toBe(first);
    expect(hashPublicRequestToken("a".repeat(64))).toBe(
      "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb",
    );
  });

  it("keeps signed upload descriptors on the private fixed bucket without secrets in errors", () => {
    expect(storageDescriptorSchema.safeParse({
      bucket: "submission-originals",
      path: "00000000-0000-4000-8000-000000000001/original.webp",
      token: "signed-token",
    }).success).toBe(true);
    expect(storageDescriptorSchema.safeParse({
      bucket: "public-cards",
      path: "anything",
      token: "signed-token",
    }).success).toBe(false);
    expect(toPublicApiError("temporarily_unavailable")).not.toHaveProperty("details");
    expect(mapDatabaseError({ message: "password=secret database exploded" })).toBe("temporarily_unavailable");
  });

  it("accepts the timezone-offset expiry returned by hosted Postgres", () => {
    expect(prepareSubmissionResponseSchema.safeParse({
      submissionId: "00000000-0000-4000-8000-000000000001",
      status: "draft",
      draftExpiresAt: "2026-08-12T09:45:18.17656+00:00",
      uploadRequired: true,
      upload: {
        bucket: "submission-originals",
        path: "00000000-0000-4000-8000-000000000001/original.webp",
        token: "signed-token",
      },
    }).success).toBe(true);
  });
});

describe("same-origin boundary", () => {
  it("accepts the matching request origin and rejects missing or foreign origins", () => {
    const headers = { "content-type": "application/json", origin: "https://campaign.example" };
    expect(isSameOriginRequest(new Request("https://campaign.example/api/test", { headers }))).toBe(true);
    expect(isSameOriginRequest(new Request("https://campaign.example/api/test"))).toBe(false);
    expect(isSameOriginRequest(new Request("https://campaign.example/api/test", {
      headers: { ...headers, origin: "https://attacker.example" },
    }))).toBe(false);
  });
});

describe("client image preparation", () => {
  it("rejects empty, oversized, executable and unsupported input", () => {
    expect(() => validateImageInput(new File([], "empty.jpg", { type: "image/jpeg" }))).toThrow(ClientImageError);
    expect(() => validateImageInput(new File([new Uint8Array(15 * 1024 * 1024 + 1)], "large.jpg", { type: "image/jpeg" }))).toThrow(/15 MB/);
    expect(() => validateImageInput(new File(["<svg/>"], "photo.svg", { type: "image/svg+xml" }))).toThrow(/JPEG/);
    expect(() => validateImageInput(new File(["video"], "photo.mp4", { type: "video/mp4" }))).toThrow(/JPEG/);
  });

  it("produces a safe WebP file within hard limits without retaining the original filename", async () => {
    imageCompression.mockResolvedValue(new File([new Uint8Array(1024)], "camera-original.jpg", { type: "image/webp" }));
    const result = await prepareImage(
      new File([new Uint8Array(2048)], "private-name.jpg", { type: "image/jpeg" }),
      { signal: new AbortController().signal },
    );
    expect(result.file.name).toBe("submission.webp");
    expect(result.preparedBytes).toBe(1024);
    expect(imageCompression).toHaveBeenCalledWith(expect.any(File), expect.objectContaining({
      preserveExif: false,
      maxWidthOrHeight: 2560,
      fileType: "image/webp",
    }));
  });

  it("rejects prepared output over 2 MB and explains unsupported HEIC decoding", async () => {
    imageCompression.mockResolvedValueOnce(
      new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.webp", { type: "image/webp" }),
    );
    await expect(prepareImage(
      new File(["input"], "photo.jpg", { type: "image/jpeg" }),
      { signal: new AbortController().signal },
    )).rejects.toMatchObject({ code: "prepared_too_large" });

    imageCompression.mockRejectedValueOnce(new Error("decoder unavailable"));
    await expect(prepareImage(
      new File(["input"], "photo.heic", { type: "image/heic" }),
      { signal: new AbortController().signal },
    )).rejects.toMatchObject({ code: "heic_unsupported" });
  });

  it("revokes only an existing preview object URL", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    revokePreviewUrl("blob:private-preview");
    revokePreviewUrl(null);
    expect(revoke).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith("blob:private-preview");
  });
});
