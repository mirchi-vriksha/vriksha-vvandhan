import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { buildCampaignWorkbook, neutralizeSpreadsheetText, type CampaignExportData } from "@/lib/export/campaign-workbook.server";

function fixtureData(rowCount = 1): CampaignExportData {
  const submissions = Array.from({ length: rowCount }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    display_name: index === 0 ? "\t=HYPERLINK(\"https://bad.test\")" : `Guardian ${index + 1}`,
    status: index % 2 ? "pending_review" : "published",
    guardian_number: index % 2 ? null : index + 1,
    source: "internal_test",
    is_test: true,
    counts_toward_goal: false,
    submitted_at: "2026-08-07T08:00:00.000Z",
    approved_at: index % 2 ? null : "2026-08-07T09:00:00.000Z",
    published_at: index % 2 ? null : "2026-08-07T09:00:00.000Z",
    rejected_at: null,
    trashed_at: null,
    rejection_comment: index === 0 ? "+SUM(1,1)" : null,
    created_at: "2026-08-07T08:00:00.000Z",
    public_request_token_hash: "must-never-export",
  }));
  return {
    submissions,
    contacts: submissions.map((row) => ({ submission_id: row.id, email: row.id.endsWith("001") ? "@malicious" : `test-${row.id.slice(-4)}@example.test` })),
    consents: submissions.map((row) => ({ submission_id: row.id, consent_version: "2026-v1", publication_consent: true, terms_accepted: true, accepted_at: "2026-08-07T08:00:00.000Z" })),
    media: submissions.map((row) => ({ submission_id: row.id, status: "published", original_mime_type: "image/webp", original_bytes: 1024, original_width: 900, original_height: 900, original_checksum_sha256: "a".repeat(64), review_thumbnail_bytes: 4096, published_card_path: "card/1-v1.webp", published_full_path: "full/1-v1.webp", published_at: "2026-08-07T09:00:00.000Z" })),
    certificates: submissions.filter((_, index) => index % 2 === 0).map((row) => ({ submission_id: row.id, status: "generated", template_version: "vriksha-bandhan-2026-v2", object_path: `${row.id}/vriksha-guardian-1-v2.pdf`, file_bytes: 200000, attempt_count: 1, generated_at: "2026-08-07T09:01:00.000Z", last_error_code: null })),
    emailDeliveries: submissions.map((row) => ({ submission_id: row.id, kind: "submission_received", status: "sent", attempt_count: 1, queued_at: "2026-08-07T08:00:01.000Z", last_attempt_at: "2026-08-07T08:00:01.000Z", sent_at: "2026-08-07T08:00:02.000Z", provider_message_id: "provider-test", last_error_code: null })),
    audit: [{ id: 1, actor_id: "a0000000-0000-4000-8000-000000000001", action: "submission.test", entity_type: "submission", entity_id: submissions[0].id, reason: "-unsafe reason", created_at: "2026-08-07T08:00:00.000Z", before_data: { secret: true } }],
    targetCount: 983,
  };
}

describe("campaign XLSX export", () => {
  it.each(["=1+1", "+cmd", "-2+3", "@SUM(A1)", "\t=1+1", " safe"])("neutralizes formula-like text %j", (value) => {
    const result = neutralizeSpreadsheetText(value);
    if (value.trimStart().match(/^[=+\-@]/)) expect(result.startsWith("'")).toBe(true);
    else expect(result).toBe(value);
  });

  it("creates the seven expected operational sheets with typed values and no sensitive fields", async () => {
    const bytes = await buildCampaignWorkbook(fixtureData(), { exportedAt: new Date("2026-08-07T10:00:00.000Z"), exportedBy: "Admin Test" });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as never);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Overview", "Submissions", "Consents", "Media", "Certificates", "Email Deliveries", "Audit"]);
    expect(workbook.title).toBe("Vriksha Bandhan Campaign Export");
    expect(workbook.creator).toBe("Vriksha Bandhan Campaign Desk");
    expect(workbook.getWorksheet("Overview")!.getCell("B2").value).toBe("Vriksha Bandhan");
    const submissions = workbook.getWorksheet("Submissions")!;
    expect(submissions.getRow(1).values).toContain("Guardian Number");
    expect(submissions.getCell("B2").value).toBe("' =HYPERLINK(\"https://bad.test\")");
    expect(submissions.getCell("B2").type).not.toBe(ExcelJS.ValueType.Formula);
    expect(submissions.getCell("C2").value).toBe("'@malicious");
    expect(submissions.getCell("E2").value).toBe(1);
    expect(submissions.getCell("I2").value).toBeInstanceOf(Date);
    expect(JSON.stringify(workbook.worksheets.map((sheet) => sheet.getRow(1).values))).not.toContain("public_request_token_hash");
    expect(workbook.getWorksheet("Audit")!.getRow(1).values).not.toContain("Before Data");
  });

  it("exports 1,000 rows within a bounded test budget", async () => {
    const started = performance.now();
    const bytes = await buildCampaignWorkbook(fixtureData(1_000), { exportedAt: new Date("2026-08-07T10:00:00.000Z"), exportedBy: "Admin Test" });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as never);
    expect(workbook.getWorksheet("Submissions")!.rowCount).toBe(1_001);
    expect(bytes.byteLength).toBeLessThan(10_000_000);
    expect(performance.now() - started).toBeLessThan(15_000);
  }, 20_000);

  it("exports 5,000 synthetic rows without exceeding the operational workbook cap", async () => {
    const started = performance.now();
    const bytes = await buildCampaignWorkbook(fixtureData(5_000), {
      exportedAt: new Date("2026-08-07T10:00:00.000Z"),
      exportedBy: "Admin Test",
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as never);
    expect(workbook.getWorksheet("Submissions")!.rowCount).toBe(5_001);
    expect(bytes.byteLength).toBeLessThan(30_000_000);
    expect(performance.now() - started).toBeLessThan(45_000);
  }, 60_000);
});
