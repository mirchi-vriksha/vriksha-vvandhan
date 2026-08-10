import "server-only";

import ExcelJS, { type CellValue, type Worksheet } from "exceljs";

export type ExportRecord = Record<string, unknown>;

export type CampaignExportData = {
  submissions: ExportRecord[];
  contacts: ExportRecord[];
  consents: ExportRecord[];
  media: ExportRecord[];
  certificates: ExportRecord[];
  emailDeliveries: ExportRecord[];
  audit: ExportRecord[];
  targetCount: number;
};

export type CampaignExportContext = {
  exportedAt: Date;
  exportedBy: string;
};

type Column = { header: string; key: string; width: number; kind?: "date" | "number" | "boolean" };

const HEADER_FILL = "173F32";
const HEADER_TEXT = "FFFFFF";

export function neutralizeSpreadsheetText(value: unknown): string {
  const text = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ");
  return /^\s*[=+\-@]/u.test(text) ? `'${text}` : text;
}

function asDate(value: unknown): Date | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function text(value: unknown): string | null {
  return value == null ? null : neutralizeSpreadsheetText(value);
}

function setupSheet(worksheet: Worksheet, columns: Column[], rows: Record<string, CellValue>[]) {
  worksheet.columns = columns.map(({ header, key, width }) => ({ header, key, width }));
  worksheet.addRows(rows);
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: columns.length } };
  worksheet.getRow(1).height = 28;
  worksheet.getRow(1).font = { bold: true, color: { argb: HEADER_TEXT } };
  worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "left" };
  worksheet.properties.defaultRowHeight = 20;
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.alignment = { vertical: "top", wrapText: false };
      if (rowNumber % 2 === 0) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F5F7F2" } };
    }
  });
  for (const column of columns) {
    const target = worksheet.getColumn(column.key);
    if (column.kind === "date") target.numFmt = "dd mmmm yyyy hh:mm";
    if (column.kind === "number") target.numFmt = "0";
  }
}

export async function buildCampaignWorkbook(data: CampaignExportData, context: CampaignExportContext): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Vriksha Vvandhan Campaign Desk";
  workbook.lastModifiedBy = neutralizeSpreadsheetText(context.exportedBy);
  workbook.created = context.exportedAt;
  workbook.modified = context.exportedAt;
  workbook.title = "Vriksha Vvandhan Campaign Export";
  workbook.subject = "Sensitive Admin-only campaign operations export";
  workbook.company = "Mirchi";

  const contactBySubmission = new Map(data.contacts.map((row) => [String(row.submission_id), row]));
  const guardianBySubmission = new Map(data.submissions.map((row) => [String(row.id), asNumber(row.guardian_number)]));
  const activeSubmissions = data.submissions.filter((row) => !row.trashed_at);
  const statusCount = (status: string) => activeSubmissions.filter((row) => row.status === status).length;
  const overviewRows = [
    ["Exported At", context.exportedAt],
    ["Exported By", neutralizeSpreadsheetText(context.exportedBy)],
    ["Total Submissions", data.submissions.length],
    ["Pending Review", statusCount("pending_review")],
    ["Rejection Awaiting Admin", statusCount("rejection_pending_admin")],
    ["Published", statusCount("published")],
    ["Rejected", statusCount("rejected")],
    ["Trashed", data.submissions.filter((row) => Boolean(row.trashed_at)).length],
    ["Test Records", data.submissions.filter((row) => row.is_test === true).length],
    ["Current Public Count", data.submissions.filter((row) => row.status === "published" && !row.trashed_at && row.is_test !== true && row.counts_toward_goal === true).length],
    ["Target", data.targetCount],
    ["Certificates Generated", data.certificates.filter((row) => row.status === "generated").length],
    ["Certificate Failures", data.certificates.filter((row) => row.status === "failed").length],
    ["Emails Sent", data.emailDeliveries.filter((row) => row.status === "sent").length],
    ["Email Failures", data.emailDeliveries.filter((row) => row.status === "failed").length],
  ].map(([metric, value]) => ({ metric: metric as CellValue, value: value as CellValue }));
  const overview = workbook.addWorksheet("Overview", { views: [{ showGridLines: false }] });
  setupSheet(overview, [{ header: "Metric", key: "metric", width: 32 }, { header: "Value", key: "value", width: 30 }], overviewRows);
  overview.getColumn("value").alignment = { horizontal: "right" };
  overview.getCell("B2").numFmt = "dd mmmm yyyy hh:mm";

  const submissions = workbook.addWorksheet("Submissions", { views: [{ showGridLines: false }] });
  setupSheet(submissions, [
    { header: "Submission ID", key: "submissionId", width: 38 }, { header: "Display Name", key: "displayName", width: 28 },
    { header: "Email", key: "email", width: 32 }, { header: "Status", key: "status", width: 24 },
    { header: "Guardian Number", key: "guardianNumber", width: 18, kind: "number" }, { header: "Source", key: "source", width: 18 },
    { header: "Test Record", key: "testRecord", width: 14, kind: "boolean" }, { header: "Counts Toward Goal", key: "countsTowardGoal", width: 20, kind: "boolean" },
    { header: "Submitted At", key: "submittedAt", width: 22, kind: "date" }, { header: "Approved At", key: "approvedAt", width: 22, kind: "date" },
    { header: "Published At", key: "publishedAt", width: 22, kind: "date" }, { header: "Rejected At", key: "rejectedAt", width: 22, kind: "date" },
    { header: "Trashed At", key: "trashedAt", width: 22, kind: "date" }, { header: "Rejection Comment", key: "rejectionComment", width: 48 },
    { header: "Created At", key: "createdAt", width: 22, kind: "date" },
  ], data.submissions.map((row) => ({
    submissionId: text(row.id), displayName: text(row.display_name), email: text(contactBySubmission.get(String(row.id))?.email),
    status: text(row.status), guardianNumber: asNumber(row.guardian_number), source: text(row.source), testRecord: asBoolean(row.is_test),
    countsTowardGoal: asBoolean(row.counts_toward_goal), submittedAt: asDate(row.submitted_at), approvedAt: asDate(row.approved_at),
    publishedAt: asDate(row.published_at), rejectedAt: asDate(row.rejected_at), trashedAt: asDate(row.trashed_at),
    rejectionComment: text(row.rejection_comment), createdAt: asDate(row.created_at),
  })));

  const consents = workbook.addWorksheet("Consents", { views: [{ showGridLines: false }] });
  setupSheet(consents, [
    { header: "Submission ID", key: "submissionId", width: 38 }, { header: "Consent Version", key: "consentVersion", width: 22 },
    { header: "Publication Consent", key: "publicationConsent", width: 22, kind: "boolean" }, { header: "Terms Accepted", key: "termsAccepted", width: 18, kind: "boolean" },
    { header: "Accepted At", key: "acceptedAt", width: 22, kind: "date" },
  ], data.consents.map((row) => ({ submissionId: text(row.submission_id), consentVersion: text(row.consent_version), publicationConsent: asBoolean(row.publication_consent), termsAccepted: asBoolean(row.terms_accepted), acceptedAt: asDate(row.accepted_at) })));

  const media = workbook.addWorksheet("Media", { views: [{ showGridLines: false }] });
  setupSheet(media, [
    { header: "Submission ID", key: "submissionId", width: 38 }, { header: "Media Status", key: "mediaStatus", width: 18 },
    { header: "Original MIME", key: "originalMime", width: 18 }, { header: "Original Bytes", key: "originalBytes", width: 18, kind: "number" },
    { header: "Original Width", key: "originalWidth", width: 18, kind: "number" }, { header: "Original Height", key: "originalHeight", width: 18, kind: "number" },
    { header: "Original SHA-256", key: "originalSha", width: 68 }, { header: "Review Thumbnail Bytes", key: "reviewBytes", width: 24, kind: "number" },
    { header: "Published Card Path", key: "cardPath", width: 46 }, { header: "Published Full Path", key: "fullPath", width: 46 },
    { header: "Published At", key: "publishedAt", width: 22, kind: "date" },
  ], data.media.map((row) => ({ submissionId: text(row.submission_id), mediaStatus: text(row.status), originalMime: text(row.original_mime_type), originalBytes: asNumber(row.original_bytes), originalWidth: asNumber(row.original_width), originalHeight: asNumber(row.original_height), originalSha: text(row.original_checksum_sha256), reviewBytes: asNumber(row.review_thumbnail_bytes), cardPath: text(row.published_card_path), fullPath: text(row.published_full_path), publishedAt: asDate(row.published_at) })));

  const certificates = workbook.addWorksheet("Certificates", { views: [{ showGridLines: false }] });
  setupSheet(certificates, [
    { header: "Submission ID", key: "submissionId", width: 38 }, { header: "Guardian Number", key: "guardianNumber", width: 18, kind: "number" },
    { header: "Status", key: "status", width: 18 }, { header: "Template Version", key: "templateVersion", width: 24 },
    { header: "Object Path", key: "objectPath", width: 58 }, { header: "File Bytes", key: "fileBytes", width: 16, kind: "number" },
    { header: "Attempt Count", key: "attemptCount", width: 16, kind: "number" }, { header: "Generated At", key: "generatedAt", width: 22, kind: "date" },
    { header: "Last Error Code", key: "lastErrorCode", width: 28 },
  ], data.certificates.map((row) => ({ submissionId: text(row.submission_id), guardianNumber: guardianBySubmission.get(String(row.submission_id)) ?? null, status: text(row.status), templateVersion: text(row.template_version), objectPath: text(row.object_path), fileBytes: asNumber(row.file_bytes), attemptCount: asNumber(row.attempt_count), generatedAt: asDate(row.generated_at), lastErrorCode: text(row.last_error_code) })));

  const emails = workbook.addWorksheet("Email Deliveries", { views: [{ showGridLines: false }] });
  setupSheet(emails, [
    { header: "Submission ID", key: "submissionId", width: 38 }, { header: "Guardian Number", key: "guardianNumber", width: 18, kind: "number" },
    { header: "Kind", key: "kind", width: 24 }, { header: "Status", key: "status", width: 18 },
    { header: "Attempt Count", key: "attemptCount", width: 16, kind: "number" }, { header: "Queued At", key: "queuedAt", width: 22, kind: "date" },
    { header: "Last Attempt At", key: "lastAttemptAt", width: 22, kind: "date" }, { header: "Sent At", key: "sentAt", width: 22, kind: "date" },
    { header: "Delivered At", key: "deliveredAt", width: 22, kind: "date" }, { header: "Bounced At", key: "bouncedAt", width: 22, kind: "date" },
    { header: "Complained At", key: "complainedAt", width: 22, kind: "date" }, { header: "Delivery Delayed At", key: "deliveryDelayedAt", width: 22, kind: "date" },
    { header: "Provider Failed At", key: "providerFailedAt", width: 22, kind: "date" },
    { header: "Provider Message ID", key: "providerMessageId", width: 36 }, { header: "Last Error Code", key: "lastErrorCode", width: 28 },
  ], data.emailDeliveries.map((row) => ({ submissionId: text(row.submission_id), guardianNumber: guardianBySubmission.get(String(row.submission_id)) ?? null, kind: text(row.kind), status: text(row.status), attemptCount: asNumber(row.attempt_count), queuedAt: asDate(row.queued_at), lastAttemptAt: asDate(row.last_attempt_at), sentAt: asDate(row.sent_at), deliveredAt: asDate(row.delivered_at), bouncedAt: asDate(row.bounced_at), complainedAt: asDate(row.complained_at), deliveryDelayedAt: asDate(row.delivery_delayed_at), providerFailedAt: asDate(row.provider_failed_at), providerMessageId: text(row.provider_message_id), lastErrorCode: text(row.last_error_code) })));

  const audit = workbook.addWorksheet("Audit", { views: [{ showGridLines: false }] });
  setupSheet(audit, [
    { header: "Audit ID", key: "auditId", width: 16, kind: "number" }, { header: "Actor ID", key: "actorId", width: 38 },
    { header: "Action", key: "action", width: 34 }, { header: "Entity Type", key: "entityType", width: 22 },
    { header: "Entity ID", key: "entityId", width: 38 }, { header: "Reason", key: "reason", width: 48 },
    { header: "Created At", key: "createdAt", width: 22, kind: "date" },
  ], data.audit.map((row) => ({ auditId: asNumber(row.id), actorId: text(row.actor_id), action: text(row.action), entityType: text(row.entity_type), entityId: text(row.entity_id), reason: text(row.reason), createdAt: asDate(row.created_at) })));

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
