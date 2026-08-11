import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFPage, PDFFont, rgb } from "pdf-lib";

import {
  buildCertificateFilename,
  CERTIFICATE_TEMPLATE_VERSION,
  formatCertificateDate,
  formatGuardianNumber,
} from "@/lib/certificates/certificate-format";

const A4_LANDSCAPE = { width: 841.8898, height: 595.2756 } as const;
const NAME_CENTER_X = 390;
const NAME_MAX_WIDTH = 435;
const NAME_MAX_SIZE = 42;
const NAME_MIN_SIZE = 18;

export type CertificateInput = {
  displayName: string;
  guardianNumber: number;
  approvedAt: string | Date;
};

export type CertificateResult = {
  bytes: Uint8Array;
  filename: string;
  byteLength: number;
  sha256: string;
  templateVersion: typeof CERTIFICATE_TEMPLATE_VERSION;
};

type NameLine = { text: string; size: number; tracking: number; x: number; y: number };

function trackingForSize(size: number) {
  return Math.max(0, (size - NAME_MIN_SIZE) * 0.34);
}

function trackedWidth(font: PDFFont, text: string, size: number, tracking: number) {
  const parts = graphemes(text);
  return parts.reduce((width, part) => width + font.widthOfTextAtSize(part, size), 0)
    + Math.max(0, parts.length - 1) * tracking;
}

function fitSize(font: PDFFont, text: string, maxWidth: number, maximum: number) {
  for (let size = maximum; size >= NAME_MIN_SIZE; size -= 0.5) {
    const tracking = trackingForSize(size);
    if (trackedWidth(font, text, size, tracking) <= maxWidth) return { size, tracking };
  }
  return null;
}

function graphemes(value: string): string[] {
  return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)]
    .map((part) => part.segment);
}

function splitCandidates(name: string): [string, string][] {
  const words = name.split(/\s+/u);
  if (words.length > 1) {
    return Array.from({ length: words.length - 1 }, (_, index) => [
      words.slice(0, index + 1).join(" "),
      words.slice(index + 1).join(" "),
    ]).sort((left, right) =>
      Math.abs(left[0].length - left[1].length) - Math.abs(right[0].length - right[1].length),
    ) as [string, string][];
  }

  const parts = graphemes(name);
  const middle = Math.ceil(parts.length / 2);
  return [[parts.slice(0, middle).join(""), parts.slice(middle).join("")]];
}

export function layoutCertificateName(font: PDFFont, rawName: string): NameLine[] {
  const name = rawName.trim().toLocaleUpperCase("en-IN");
  if (!name) throw new Error("invalid_display_name");

  const single = fitSize(font, name, NAME_MAX_WIDTH, NAME_MAX_SIZE);
  if (single) {
    const width = trackedWidth(font, name, single.size, single.tracking);
    return [{ text: name, ...single, x: NAME_CENTER_X - width / 2, y: 284 }];
  }

  for (const [first, second] of splitCandidates(name)) {
    const firstFit = fitSize(font, first, NAME_MAX_WIDTH, 23);
    const secondFit = fitSize(font, second, NAME_MAX_WIDTH, 23);
    if (!firstFit || !secondFit) continue;
    const size = Math.min(firstFit.size, secondFit.size);
    const tracking = trackingForSize(size);
    return [
      { text: first, size, tracking, x: NAME_CENTER_X - trackedWidth(font, first, size, tracking) / 2, y: 303 },
      { text: second, size, tracking, x: NAME_CENTER_X - trackedWidth(font, second, size, tracking) / 2, y: 279 },
    ];
  }

  throw new Error("display_name_too_long");
}

function drawCentered(page: PDFPage, font: PDFFont, text: string, centerX: number, y: number, size: number) {
  page.drawText(text, {
    x: centerX - font.widthOfTextAtSize(text, size) / 2,
    y,
    size,
    font,
    color: rgb(0.02, 0.22, 0.15),
  });
}

function drawTrackedText(page: PDFPage, font: PDFFont, line: NameLine) {
  let x = line.x;
  for (const part of graphemes(line.text)) {
    page.drawText(part, { x, y: line.y, size: line.size, font, color: rgb(0.02, 0.22, 0.15) });
    x += font.widthOfTextAtSize(part, line.size) + line.tracking;
  }
}

export async function generateCertificate(input: CertificateInput): Promise<CertificateResult> {
  const [masterBytes, fontBytes] = await Promise.all([
    readFile(path.join(process.cwd(), "src/assets/certificate/vriksha-bandhan-certificate-master.png")),
    readFile(path.join(process.cwd(), "src/assets/fonts/Marcellus-Regular.ttf")),
  ]);
  const approvedAt = input.approvedAt instanceof Date ? input.approvedAt : new Date(input.approvedAt);
  if (Number.isNaN(approvedAt.getTime())) throw new Error("invalid_approval_date");

  const document = await PDFDocument.create({ updateMetadata: false });
  document.registerFontkit(fontkit);
  document.setTitle(`Vriksha Guardian ${formatGuardianNumber(input.guardianNumber)}`);
  document.setAuthor("Vriksha Bandhan by Mirchi");
  document.setCreator(`Vriksha Bandhan certificate service · ${CERTIFICATE_TEMPLATE_VERSION}`);
  document.setProducer(`Vriksha Bandhan ${CERTIFICATE_TEMPLATE_VERSION}`);
  document.setSubject(`Campaign recognition certificate · ${CERTIFICATE_TEMPLATE_VERSION}`);
  document.setCreationDate(approvedAt);
  document.setModificationDate(approvedAt);

  const page = document.addPage([A4_LANDSCAPE.width, A4_LANDSCAPE.height]);
  const [master, font] = await Promise.all([
    document.embedPng(Uint8Array.from(masterBytes)),
    document.embedFont(Uint8Array.from(fontBytes), { subset: true }),
  ]);
  page.drawImage(master, { x: 0, y: 0, width: A4_LANDSCAPE.width, height: A4_LANDSCAPE.height });

  for (const line of layoutCertificateName(font, input.displayName)) {
    drawTrackedText(page, font, line);
  }

  const guardianNumber = formatGuardianNumber(input.guardianNumber);
  drawCentered(page, font, guardianNumber, 385.5, 143.5, 31.5);
  drawCentered(page, font, formatCertificateDate(approvedAt), 132.5, 72.5, 12.5);
  drawCentered(page, font, guardianNumber, 379.5, 30.2, 9.5);

  const bytes = await document.save({
    addDefaultPage: false,
    useObjectStreams: false,
    updateFieldAppearances: false,
  });
  return {
    bytes,
    filename: buildCertificateFilename(input.guardianNumber),
    byteLength: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    templateVersion: CERTIFICATE_TEMPLATE_VERSION,
  };
}
