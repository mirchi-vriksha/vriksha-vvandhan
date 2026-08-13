import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prepareImage: vi.fn(),
  upload: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock("@/lib/submissions/client-image", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/submissions/client-image")>();
  return {
    ...original,
    prepareImage: mocks.prepareImage,
    revokePreviewUrl: mocks.revoke,
  };
});
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    storage: { from: () => ({ uploadToSignedUrl: mocks.upload }) },
  }),
}));

import { PublicSubmissionForm } from "@/components/submission/public-submission-form";
import { SubmissionAvailability } from "@/components/submission/submission-availability";

const prepared = {
  file: new File(["prepared"], "submission.webp", { type: "image/webp" }),
  extension: "webp" as const,
  mimeType: "image/webp" as const,
  originalBytes: 2000,
  preparedBytes: 8,
};

function response(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

async function choosePhoto() {
  fireEvent.change(screen.getByLabelText(/Choose from device/i), {
    target: { files: [new File(["photo"], "tree.jpg", { type: "image/jpeg" })] },
  });
  await screen.findByAltText("Preview of your prepared submission");
}

async function completeFields() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Display name"), "Participant");
  await user.type(screen.getByLabelText("Email address"), "person@example.com");
  const checks = screen.getAllByRole("checkbox");
  await user.click(checks[0]);
  await user.click(checks[1]);
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:prepared-preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
  mocks.prepareImage.mockResolvedValue(prepared);
  mocks.upload.mockResolvedValue({ error: null });
});

describe("public submission form", () => {
  it("renders exactly the approved controls with camera and device choices", () => {
    render(<PublicSubmissionForm />);
    expect(screen.getByLabelText(/Take a photo/i)).toHaveAttribute("capture", "environment");
    expect(screen.getByLabelText(/Choose from device/i)).toHaveAttribute("type", "file");
    expect(screen.getByLabelText("Display name")).toBeRequired();
    expect(screen.getByLabelText("Email address")).toBeRequired();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).not.toBeChecked();
    }
    expect(document.querySelector('[name="city"], [name="phone"], [name="website"]')).toBeNull();
  });

  it("exposes the photo controls in keyboard order", async () => {
    const user = userEvent.setup();
    render(<PublicSubmissionForm />);
    await user.tab();
    expect(screen.getByLabelText(/Take a photo/i)).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText(/Choose from device/i)).toHaveFocus();
  });

  it("shows an error summary, links inline errors, and focuses the first invalid field", async () => {
    const user = userEvent.setup();
    render(<PublicSubmissionForm />);
    await user.click(screen.getByRole("button", { name: "Submit for private review" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose and prepare one photograph");
    await waitFor(() => expect(screen.getByLabelText("Display name")).toHaveFocus());
    expect(screen.getByLabelText("Email address")).toHaveAttribute("aria-invalid", "true");
  });

  it("previews, replaces and removes prepared images without exposing a filename", async () => {
    const user = userEvent.setup();
    render(<PublicSubmissionForm />);
    await choosePhoto();
    expect(screen.getByText("Ready for secure upload")).toBeVisible();
    expect(screen.queryByText("tree.jpg")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Replace photo/i), {
      target: { files: [new File(["replacement"], "replacement.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(mocks.prepareImage).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(screen.getByLabelText(/Take a photo/i)).toBeInTheDocument();
    expect(mocks.revoke).toHaveBeenCalledWith("blob:prepared-preview");
  });

  it("shows progress, uploads directly, finalises, and focuses the confirmation", async () => {
    const fetchMock = vi.mocked(fetch);
    let resolvePrepare!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolvePrepare = resolve; }));
    fetchMock.mockImplementationOnce(() => response({ success: true, status: "pending_review" }));
    render(<PublicSubmissionForm />);
    await choosePhoto();
    const user = await completeFields();
    await user.click(screen.getByRole("button", { name: "Submit for private review" }));
    expect(screen.getByRole("region", { name: "Submission progress" })).toHaveTextContent("Reserving private submission");

    resolvePrepare(new Response(JSON.stringify({
      submissionId: "00000000-0000-4000-8000-000000000001",
      status: "draft",
      draftExpiresAt: "2026-08-12T09:45:18.17656+00:00",
      uploadRequired: true,
      upload: {
        bucket: "submission-originals",
        path: "00000000-0000-4000-8000-000000000001/original.webp",
        token: "signed-token",
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const heading = await screen.findByRole("heading", { name: "Your submission has been received." });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Your image is not public yet.")).toBeVisible();
  });

  it("keeps all form state and offers one clear retry after a transient failure", async () => {
    vi.mocked(fetch).mockImplementationOnce(() => response({
      success: false,
      code: "temporarily_unavailable",
      message: "Submissions are temporarily unavailable. Your details have not been sent.",
      retryable: true,
    }, 503));
    render(<PublicSubmissionForm />);
    await choosePhoto();
    const user = await completeFields();
    await user.click(screen.getByRole("button", { name: "Submit for private review" }));
    expect(await screen.findByRole("button", { name: "Retry submission" })).toBeVisible();
    expect(screen.getByLabelText("Display name")).toHaveValue("Participant");
    expect(screen.getByAltText("Preview of your prepared submission")).toBeVisible();
  });
});

describe("campaign availability states", () => {
  it.each([
    ["closed", "Submissions opening soon."],
    ["unavailable", "Submissions are temporarily unavailable."],
  ] as const)("renders the %s fail-closed state", (state, heading) => {
    render(<SubmissionAvailability state={state} />);
    expect(screen.getByRole("heading", { name: heading })).toBeVisible();
  });
});
