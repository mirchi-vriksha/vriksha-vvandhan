import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  requireStaff: vi.fn(),
  publishSubmission: vi.fn(),
  processApprovalDelivery: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  isStaffE2EAdapterEnabled: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ requireStaff: mocks.requireStaff, requireRole: vi.fn() }));
vi.mock("@/lib/email/delivery-orchestration.server", () => ({
  processApprovalDelivery: mocks.processApprovalDelivery,
  processSubmissionDelivery: vi.fn(),
}));
vi.mock("@/lib/moderation/publication.server", () => ({ publishSubmission: mocks.publishSubmission }));
vi.mock("@/lib/moderation/publication-image.server", () => ({ generatePublicVariants: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createServerSupabaseClient }));
vi.mock("@/lib/testing/staff-adapter", () => ({ isStaffE2EAdapterEnabled: mocks.isStaffE2EAdapterEnabled }));

import { approveSubmissionAction } from "@/app/admin/actions";

const submissionId = "e1000000-0000-4000-8000-000000000001";

describe("approveSubmissionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaff.mockResolvedValue({ userId: "staff-1", role: "admin" });
    mocks.createServerSupabaseClient.mockResolvedValue({});
    mocks.publishSubmission.mockResolvedValue(42);
    mocks.processApprovalDelivery.mockResolvedValue({ outcome: "sent" });
    mocks.isStaffE2EAdapterEnabled.mockReturnValue(false);
    mocks.redirect.mockImplementation((destination: string) => {
      throw new Error(`redirect:${destination}`);
    });
  });

  it("waits for automatic certificate email processing before reporting success", async () => {
    const formData = new FormData();
    formData.set("submissionId", submissionId);

    await expect(approveSubmissionAction(formData)).rejects.toThrow(
      `redirect:/admin/submissions/${submissionId}?success=published&delivery=sent`,
    );
    expect(mocks.publishSubmission).toHaveBeenCalledOnce();
    expect(mocks.processApprovalDelivery).toHaveBeenCalledWith(submissionId);
    expect(mocks.processApprovalDelivery.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.redirect.mock.invocationCallOrder[0],
    );
  });

  it("keeps publication successful and exposes the durable retry state when delivery fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.processApprovalDelivery.mockRejectedValue(new Error("provider unavailable"));
    const formData = new FormData();
    formData.set("submissionId", submissionId);

    await expect(approveSubmissionAction(formData)).rejects.toThrow(
      `redirect:/admin/submissions/${submissionId}?success=published&delivery=retrying`,
    );
    expect(mocks.publishSubmission).toHaveBeenCalledOnce();
  });
});
