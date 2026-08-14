import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SubmissionQueueTable } from "@/components/admin/submission-queue-table";
import type { QueueSubmission } from "@/lib/moderation/data.server";

const row: QueueSubmission = {
  id: "00000000-0000-4000-8000-000000000001",
  status: "pending_review",
  display_name: "Queue text first",
  submitted_at: "2026-08-07T04:00:00.000Z",
  submittedLabel: "07/08/2026",
  guardian_number: null,
  source: "public_web",
  is_test: false,
  trashed_at: null,
  thumbnailAvailable: true,
  reviewAgeHours: 1,
};

beforeEach(() => vi.restoreAllMocks());

describe("moderation queue thumbnails", () => {
  it("renders text and a fixed skeleton before the independent signed-URL request resolves", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));

    const { container } = render(<SubmissionQueueTable submissions={[row]} labels={{ pending_review: "Pending Review" }} />);

    expect(screen.getByText("Queue text first")).toBeVisible();
    expect(screen.getByRole("list")).toBeVisible();
    expect(container.querySelector("table")).not.toBeInTheDocument();
    expect(container.querySelector(".admin-thumbnail--skeleton")).toBeInTheDocument();
    expect(screen.queryByAltText("Private submission preview")).not.toBeInTheDocument();

    resolveFetch?.(new Response(JSON.stringify({ thumbnails: { [row.id]: "https://private.test/thumb" } }), { status: 200 }));
    const image = await screen.findByAltText("Private submission preview");
    expect(image).toHaveAttribute("src", "https://private.test/thumb");
    expect(image).toHaveAttribute("width", "96");
    expect(image).toHaveAttribute("height", "120");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("decoding", "async");

    const request = vi.mocked(fetch).mock.calls[0];
    expect(String(request[1]?.body)).toContain(row.id);
    expect(String(request[1]?.body)).not.toContain("original");
    expect(String(request[1]?.body)).not.toContain("review-thumb");
  });

  it("shows a neutral fallback when signing or image loading fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "temporarily_unavailable" }), { status: 503 }));
    render(<SubmissionQueueTable submissions={[row]} labels={{ pending_review: "Pending Review" }} />);
    await waitFor(() => expect(screen.getByLabelText("Private preview unavailable")).toBeVisible());
    expect(screen.getByText("Queue text first")).toBeVisible();
  });

  it("requests 25 thumbnail IDs once without serial signing or original paths", async () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({
      ...row,
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      display_name: `Synthetic row ${index + 1}`,
    }));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ thumbnails: {} }), { status: 200 }));

    render(<SubmissionQueueTable submissions={rows} labels={{ pending_review: "Pending Review" }} />);
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body)) as { submissionIds: string[] };
    expect(body.submissionIds).toHaveLength(25);
    expect(JSON.stringify(body)).not.toContain("original");
    expect(JSON.stringify(body)).not.toContain("review-thumb");
    expect(screen.getByText("Synthetic row 25")).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(25);
  });
});
