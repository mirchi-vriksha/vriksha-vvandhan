export const CERTIFICATE_TEMPLATE_VERSION = "vriksha-bandhan-2026-v3";

const INDIA_TIME_ZONE = "Asia/Kolkata";

export function formatGuardianNumber(guardianNumber: number): string {
  if (!Number.isSafeInteger(guardianNumber) || guardianNumber <= 0) {
    throw new Error("invalid_guardian_number");
  }
  return String(guardianNumber);
}

export function formatCertificateDate(approvedAt: string | Date): string {
  const date = approvedAt instanceof Date ? approvedAt : new Date(approvedAt);
  if (Number.isNaN(date.getTime())) throw new Error("invalid_approval_date");

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: INDIA_TIME_ZONE,
  }).format(date);
}

export function buildCertificateStoragePath(
  submissionId: string,
  guardianNumber: number,
  templateVersion = CERTIFICATE_TEMPLATE_VERSION,
): string {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(submissionId)) {
    throw new Error("invalid_submission_id");
  }
  const safeVersion = templateVersion.match(/-v([a-zA-Z0-9]+)$/)?.[1];
  if (!safeVersion) throw new Error("invalid_template_version");
  return `${submissionId}/vriksha-guardian-${guardianNumber}-v${safeVersion}.pdf`;
}

export function buildCertificateFilename(guardianNumber: number): string {
  return `Vriksha-Guardian-${formatGuardianNumber(guardianNumber)}.pdf`;
}
