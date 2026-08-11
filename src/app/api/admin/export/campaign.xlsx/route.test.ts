import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError, UnauthenticatedError } from "@/lib/auth/errors";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  loadData: vi.fn(),
  buildWorkbook: vi.fn(),
  rpc: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/auth/dal", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/export/load-campaign-export.server", () => ({ loadCampaignExportData: mocks.loadData }));
vi.mock("@/lib/export/campaign-workbook.server", () => ({ buildCampaignWorkbook: mocks.buildWorkbook }));
vi.mock("@/lib/supabase/rpc.server", () => ({ callUntypedRpc: mocks.rpc }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createClient }));

import { GET } from "@/app/api/admin/export/campaign.xlsx/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireRole.mockResolvedValue({ userId: "a0000000-0000-4000-8000-000000000001", displayName: "Admin Test", role: "admin" });
  mocks.loadData.mockResolvedValue({ submissions: [{ id: "one" }] });
  mocks.buildWorkbook.mockResolvedValue(Buffer.from("xlsx-test"));
  mocks.createClient.mockResolvedValue({});
  mocks.rpc.mockResolvedValue({ data: null, error: null });
});

describe("Admin campaign export route", () => {
  it("returns a private XLSX and audits the successful generation", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="Vriksha-Bandhan-Campaign-Export-/);
    expect(mocks.requireRole).toHaveBeenCalledWith("admin");
    expect(mocks.rpc).toHaveBeenCalledWith(expect.anything(), "record_campaign_data_export", { p_row_count: 1 });
  });

  it("denies reviewers without loading PII", async () => {
    mocks.requireRole.mockRejectedValue(new ForbiddenError());
    const response = await GET();
    expect(response.status).toBe(403);
    expect(mocks.loadData).not.toHaveBeenCalled();
  });

  it("denies signed-out callers without loading PII", async () => {
    mocks.requireRole.mockRejectedValue(new UnauthenticatedError());
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.loadData).not.toHaveBeenCalled();
  });
});
