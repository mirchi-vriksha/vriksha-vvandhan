import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  buildCertificateFilename,
  buildCertificateStoragePath,
  CERTIFICATE_TEMPLATE_VERSION,
  formatCertificateDate,
  formatGuardianNumber,
} from "@/lib/certificates/certificate-format";
import { generateCertificate } from "@/lib/certificates/generate-certificate.server";

const input = {
  displayName: "Jay Pandey",
  guardianNumber: 427,
  approvedAt: "2026-08-06T20:45:00.000Z",
};

describe("certificate formatting", () => {
  it.each([[1, "0001"], [27, "0027"], [427, "0427"], [983, "0983"], [10234, "10234"]])(
    "formats Guardian number %i",
    (value, expected) => expect(formatGuardianNumber(value)).toBe(expected),
  );

  it("uses the approval instant in Asia/Kolkata", () => {
    expect(formatCertificateDate(input.approvedAt)).toBe("07 August 2026");
  });

  it("builds a private versioned path without PII", () => {
    const path = buildCertificateStoragePath("3f000000-0000-4000-8000-000000000001", 427);
    expect(path).toBe("3f000000-0000-4000-8000-000000000001/vriksha-guardian-427-v2.pdf");
    expect(path).not.toContain("Jay");
    expect(buildCertificateFilename(427)).toBe("Vriksha-Guardian-0427.pdf");
  });
});

describe("generateCertificate", () => {
  it("renders a valid deterministic A4 landscape PDF", async () => {
    const first = await generateCertificate(input);
    const second = await generateCertificate(input);
    const pdf = await PDFDocument.load(first.bytes);
    const page = pdf.getPage(0);

    expect(first.templateVersion).toBe(CERTIFICATE_TEMPLATE_VERSION);
    expect(first.byteLength).toBeGreaterThan(100_000);
    expect(first.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first.sha256).toBe(second.sha256);
    expect(page.getWidth()).toBeCloseTo(841.8898, 2);
    expect(page.getHeight()).toBeCloseTo(595.2756, 2);
    expect(pdf.getAuthor()).toBe("Vriksha Bandhan by Mirchi");
    expect(pdf.getCreator()).toContain("vriksha-bandhan-2026-v2");
    expect(pdf.getSubject()).toContain("vriksha-bandhan-2026-v2");
  });

  it("supports Unicode and a long two-line name without truncation", async () => {
    const unicode = await generateCertificate({
      ...input,
      displayName: "José María Alexandria Cassandra Montgomery-Worthington",
    });
    expect(unicode.byteLength).toBeGreaterThan(100_000);
    await expect(PDFDocument.load(unicode.bytes)).resolves.toBeDefined();
  });

  it("rejects an impossible name instead of silently truncating it", async () => {
    await expect(generateCertificate({
      ...input,
      displayName: "José María Alexandria Cassandra Evangeline Montgomery-Worthington de la Vega-Rodríguez",
    })).rejects.toThrow("display_name_too_long");
  });
});
