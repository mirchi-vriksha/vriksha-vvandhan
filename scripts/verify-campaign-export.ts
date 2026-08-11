import { writeFile } from "node:fs/promises";

import ExcelJS from "exceljs";

import { buildCampaignWorkbook, type CampaignExportData } from "@/lib/export/campaign-workbook.server";

async function main() {
  const submissions = Array.from({ length: 1_000 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    display_name: index === 0 ? "=unsafe fixture" : `Synthetic Guardian ${index + 1}`,
    status: "pending_review", guardian_number: null, source: "internal_test", is_test: true,
    counts_toward_goal: false, submitted_at: "2026-08-07T08:00:00.000Z", approved_at: null,
    published_at: null, rejected_at: null, trashed_at: null, rejection_comment: null,
    created_at: "2026-08-07T08:00:00.000Z",
  }));
  const data: CampaignExportData = {
    submissions,
    contacts: submissions.map((row) => ({ submission_id: row.id, email: `synthetic-${row.id.slice(-6)}@example.test` })),
    consents: [], media: [], certificates: [], emailDeliveries: [], audit: [], targetCount: 983,
  };
  const bytes = await buildCampaignWorkbook(data, { exportedAt: new Date("2026-08-07T10:00:00.000Z"), exportedBy: "Section 5 Verification" });
  const outputPath = "/private/tmp/Vriksha-Bandhan-Campaign-Export-Verification.xlsx";
  await writeFile(outputPath, bytes);
  const parsed = new ExcelJS.Workbook();
  await parsed.xlsx.load(bytes as never);
  const sheetNames = parsed.worksheets.map((sheet) => sheet.name);
  if (sheetNames.join("|") !== "Overview|Submissions|Consents|Media|Certificates|Email Deliveries|Audit") throw new Error("export_sheet_verification_failed");
  if (parsed.getWorksheet("Submissions")?.rowCount !== 1_001) throw new Error("export_row_verification_failed");
  if (parsed.getWorksheet("Submissions")?.getCell("B2").type === ExcelJS.ValueType.Formula) throw new Error("export_formula_safety_failed");
  console.log(JSON.stringify({ outputPath, byteLength: bytes.byteLength, sheets: sheetNames, submissionRows: 1_000, parsed: true, formulaSafety: true }));
}

void main();
