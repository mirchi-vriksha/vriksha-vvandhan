import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class ServiceError extends Error {
    constructor(public readonly code: string) {
      super(code);
    }
  }
  return {
    ServiceError,
    prepare: vi.fn(),
    finalize: vi.fn(),
    processSubmissionDelivery: vi.fn(),
  };
});

vi.mock("@/lib/email/delivery-orchestration.server", () => ({
  processSubmissionDelivery: mocks.processSubmissionDelivery,
}));

vi.mock("@/lib/submissions/service.server", () => ({
  SubmissionServiceError: mocks.ServiceError,
  preparePublicSubmission: mocks.prepare,
  finalizePublicSubmission: mocks.finalize,
}));

import { POST as finalize } from "@/app/api/submissions/finalize/route";
import { POST as prepare } from "@/app/api/submissions/prepare/route";

const origin = "https://campaign.example";
const token = "a".repeat(64);

function jsonRequest(path: string, body: unknown, requestOrigin = origin) {
  return new Request(`${origin}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: requestOrigin },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.processSubmissionDelivery.mockResolvedValue({
    outcome: "sent",
    providerMessageId: "provider-message-1",
  });
});

describe("prepare submission handler", () => {
  it("validates and returns a no-store private upload reservation", async () => {
    mocks.prepare.mockResolvedValue({
      submissionId: "00000000-0000-4000-8000-000000000001",
      status: "draft",
      draftExpiresAt: "2026-08-07T00:00:00.000Z",
      uploadRequired: true,
      upload: {
        bucket: "submission-originals",
        path: "00000000-0000-4000-8000-000000000001/original.webp",
        token: "signed-upload-token",
      },
    });
    const response = await prepare(jsonRequest("/api/submissions/prepare", {
      displayName: " Participant ",
      email: "Person@Example.com",
      publicationConsent: true,
      termsAccepted: true,
      requestToken: token,
      preparedExtension: "webp",
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.prepare).toHaveBeenCalledWith(expect.objectContaining({
      displayName: "Participant",
      email: "person@example.com",
    }));
    expect(await response.json()).not.toHaveProperty("secretKey");
  });

  it("rejects cross-origin, malformed, extra-field and non-consenting requests", async () => {
    const base = {
      displayName: "Participant",
      email: "participant@example.com",
      publicationConsent: true,
      termsAccepted: true,
      requestToken: token,
      preparedExtension: "webp",
    };
    for (const request of [
      jsonRequest("/api/submissions/prepare", base, "https://attacker.example"),
      new Request(`${origin}/api/submissions/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: "{",
      }),
      jsonRequest("/api/submissions/prepare", { ...base, city: "Mumbai" }),
      jsonRequest("/api/submissions/prepare", { ...base, publicationConsent: false }),
    ]) {
      const response = await prepare(request);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ success: false, code: "invalid_request" });
    }
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it("maps database failures to stable public messages without PII", async () => {
    mocks.prepare.mockRejectedValue(new mocks.ServiceError("submission_limit_reached"));
    const response = await prepare(jsonRequest("/api/submissions/prepare", {
      displayName: "Private Person",
      email: "private@example.com",
      publicationConsent: true,
      termsAccepted: true,
      requestToken: token,
      preparedExtension: "jpg",
    }));
    const text = await response.text();
    expect(response.status).toBe(429);
    expect(text).not.toContain("private@example.com");
    expect(text).not.toContain(token);
    expect(text).toContain("submission_limit_reached");
  });
});

describe("finalize submission handler", () => {
  it("validates the capability and returns only Pending Review", async () => {
    mocks.finalize.mockResolvedValue({ success: true, status: "pending_review" });
    const response = await finalize(jsonRequest("/api/submissions/finalize", {
      submissionId: "00000000-0000-4000-8000-000000000001",
      requestToken: token,
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, status: "pending_review" });
    expect(mocks.processSubmissionDelivery).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      "submission_received",
    );
  });

  it("keeps the accepted submission successful when the immediate receipt attempt fails", async () => {
    mocks.finalize.mockResolvedValue({ success: true, status: "pending_review" });
    mocks.processSubmissionDelivery.mockRejectedValue(new Error("provider unavailable"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await finalize(jsonRequest("/api/submissions/finalize", {
      submissionId: "00000000-0000-4000-8000-000000000001",
      requestToken: token,
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, status: "pending_review" });
    expect(errorLog).toHaveBeenCalledWith(
      "Submission receipt delivery attempt failed; durable retry remains queued.",
    );
    errorLog.mockRestore();
  });

  it("returns a generic retryable response for an unexpected internal failure", async () => {
    mocks.finalize.mockRejectedValue(new Error("SQL included private@example.com and secret-token"));
    const response = await finalize(jsonRequest("/api/submissions/finalize", {
      submissionId: "00000000-0000-4000-8000-000000000001",
      requestToken: token,
    }));
    const text = await response.text();
    expect(response.status).toBe(503);
    expect(text).not.toContain("private@example.com");
    expect(text).not.toContain("secret-token");
    expect(mocks.processSubmissionDelivery).not.toHaveBeenCalled();
  });
});
