import "server-only";

import { createHash } from "node:crypto";

import { CERTIFICATE_TEMPLATE_VERSION, buildCertificateStoragePath } from "@/lib/certificates/certificate-format";
import { generateCertificate } from "@/lib/certificates/generate-certificate.server";
import { CERTIFICATES_BUCKET } from "@/lib/storage/buckets";
import { callUntypedRpc } from "@/lib/supabase/rpc.server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

type CertificateClaim = {
  certificate_id: string;
  claim_token: string;
  display_name: string;
  guardian_number: number;
  approved_at: string;
  previous_object_path: string | null;
};

export type CertificateProcessResult =
  | { outcome: "generated"; certificateId: string; objectPath: string }
  | { outcome: "not_eligible" };

function certificateErrorCode(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === "display_name_too_long") return "display_name_too_long";
    if (error.message.includes("duplicate") || error.message.includes("already exists")) return "storage_conflict";
  }
  return "certificate_generation_failed";
}

export async function processCertificateGeneration(
  submissionId: string,
  options: { forceRegeneration?: boolean; allowExhaustedRetry?: boolean } = {},
): Promise<CertificateProcessResult> {
  const service = getServiceSupabaseClient();
  const { data, error } = await callUntypedRpc<CertificateClaim[]>(service, "claim_certificate_generation", {
    p_submission_id: submissionId,
    p_template_version: CERTIFICATE_TEMPLATE_VERSION,
    p_force_regeneration: options.forceRegeneration === true,
    p_allow_exhausted: options.allowExhaustedRetry === true,
  });
  if (error) throw new Error("certificate_claim_failed");
  const claim = data?.[0];
  if (!claim) return { outcome: "not_eligible" };

  const objectPath = buildCertificateStoragePath(submissionId, claim.guardian_number);
  let uploaded = false;
  try {
    const certificate = await generateCertificate({
      displayName: claim.display_name,
      guardianNumber: claim.guardian_number,
      approvedAt: claim.approved_at,
    });

    if (options.forceRegeneration && claim.previous_object_path === objectPath) {
      const removal = await service.storage.from(CERTIFICATES_BUCKET).remove([objectPath]);
      if (removal.error) throw new Error("certificate_previous_version_cleanup_failed");
    }

    const upload = await service.storage.from(CERTIFICATES_BUCKET).upload(objectPath, certificate.bytes, {
      contentType: "application/pdf",
      cacheControl: "0",
      upsert: false,
    });
    if (upload.error) {
      const message = upload.error.message.toLowerCase();
      if (!message.includes("duplicate") && !message.includes("already exists")) {
        throw upload.error;
      }
      const existing = await service.storage.from(CERTIFICATES_BUCKET).download(objectPath);
      if (existing.error || !existing.data) throw upload.error;
      const existingBytes = Buffer.from(await existing.data.arrayBuffer());
      const existingSha = createHash("sha256").update(existingBytes).digest("hex");
      if (existingBytes.byteLength !== certificate.byteLength || existingSha !== certificate.sha256) {
        throw new Error("storage_conflict");
      }
    } else {
      uploaded = true;
    }

    const verification = await service.storage.from(CERTIFICATES_BUCKET).download(objectPath);
    if (verification.error || !verification.data) throw new Error("certificate_upload_verification_failed");
    const verifiedBytes = Buffer.from(await verification.data.arrayBuffer());
    const verifiedSha = createHash("sha256").update(verifiedBytes).digest("hex");
    if (verifiedBytes.byteLength !== certificate.byteLength || verifiedSha !== certificate.sha256) {
      throw new Error("certificate_upload_verification_failed");
    }

    const completion = await callUntypedRpc<boolean>(service, "complete_certificate_generation", {
      p_certificate_id: claim.certificate_id,
      p_claim_token: claim.claim_token,
      p_template_version: certificate.templateVersion,
      p_object_path: objectPath,
      p_file_bytes: certificate.byteLength,
      p_checksum_sha256: certificate.sha256,
    });
    if (completion.error || completion.data !== true) throw new Error("certificate_completion_failed");
    return { outcome: "generated", certificateId: claim.certificate_id, objectPath };
  } catch (caught) {
    if (uploaded) await service.storage.from(CERTIFICATES_BUCKET).remove([objectPath]).catch(() => undefined);
    await callUntypedRpc<boolean>(service, "fail_certificate_generation", {
      p_certificate_id: claim.certificate_id,
      p_claim_token: claim.claim_token,
      p_error_code: certificateErrorCode(caught),
    }).catch(() => undefined);
    throw caught;
  }
}

export async function createCertificateDownloadUrl(objectPath: string, expiresIn = 120): Promise<string> {
  if (expiresIn < 60 || expiresIn > 300) throw new Error("invalid_certificate_url_expiry");
  const result = await getServiceSupabaseClient().storage
    .from(CERTIFICATES_BUCKET)
    .createSignedUrl(objectPath, expiresIn, { download: true });
  if (result.error || !result.data?.signedUrl) throw new Error("certificate_download_unavailable");
  return result.data.signedUrl;
}
