import { randomUUID } from "node:crypto";

import { PDFDocument } from "pdf-lib";

import { formatCertificateDate, formatGuardianNumber } from "../src/lib/certificates/certificate-format.ts";
import { generateCertificate } from "../src/lib/certificates/generate-certificate.server.ts";
import { processCertificateGeneration } from "../src/lib/certificates/process-certificate.server.ts";
import { processEmailDelivery } from "../src/lib/email/process-email-delivery.server.ts";
import { CERTIFICATES_BUCKET } from "../src/lib/storage/buckets.ts";
import { getServiceSupabaseClient } from "../src/lib/supabase/service.ts";

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function safeFailure(error) {
  const message = error instanceof Error ? error.message : "";
  return /^[a-z0-9_]{1,80}$/.test(message) ? message : "staging_smoke_failed";
}

async function publicCount(client) {
  const result = await client.rpc("get_public_campaign_summary");
  if (result.error || !result.data?.[0]) throw new Error("staging_count_unavailable");
  return Number(result.data[0].current_count);
}

async function main() {
  const execute = process.argv.includes("--execute");
  const certificateOnly = process.argv.includes("--certificate-only");
  const recipient = option("--recipient");
  if (process.env.SUPABASE_TARGET_ENVIRONMENT !== "staging") throw new Error("staging_guard_required");
  const allowedRecipients = (process.env.EMAIL_TEST_RECIPIENTS || process.env.EMAIL_TEST_RECIPIENT || "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (!certificateOnly && (!recipient || !allowedRecipients.includes(recipient.toLowerCase()))) {
    throw new Error("explicit_test_recipient_required");
  }
  if (!execute) {
    console.log(JSON.stringify({
      mode: "dry-run",
      stagingGuard: true,
      certificateOnly,
      explicitRecipient: certificateOnly ? "not-required" : true,
      emailEnabled: process.env.EMAIL_SENDING_ENABLED === "true",
    }));
    return;
  }
  if (!certificateOnly && process.env.EMAIL_SENDING_ENABLED !== "true") throw new Error("email_sending_disabled");

  const client = getServiceSupabaseClient();
  const baselineCount = await publicCount(client);
  const submissionId = randomUUID();
  const certificateId = randomUUID();
  const deliveryId = randomUUID();
  const displayName = "Section Five Staging Guardian";
  const approvedAt = new Date("2026-08-07T06:30:00.000Z");
  const guardianNumber = 9_000_000_000 + Math.floor(Math.random() * 100_000_000);
  let objectPath = null;

  try {
    const admin = await client.from("staff_profiles").select("id").eq("role", "admin").eq("active", true).limit(1).maybeSingle();
    if (admin.error || !admin.data) throw new Error("staging_admin_missing");
    const submission = await client.from("submissions").insert({ id: submissionId, source: "website", is_test: false, counts_toward_goal: false });
    if (submission.error) throw new Error("staging_fixture_creation_failed");
    const relations = await Promise.all([
      client.from("submission_consents").insert({ submission_id: submissionId, consent_version: "section5-staging-smoke", publication_consent: true, terms_accepted: true, accepted_at: approvedAt.toISOString() }),
      client.from("submission_contacts").insert({
        submission_id: submissionId,
        email: certificateOnly ? "certificate-smoke@example.test" : recipient,
      }),
      client.from("certificates").insert({ id: certificateId, submission_id: submissionId, status: "not_started" }),
      ...(certificateOnly ? [] : [
        client.from("email_deliveries").insert({ id: deliveryId, submission_id: submissionId, kind: "approval_certificate", status: "not_started", idempotency_key: `approval_certificate:${submissionId}` }),
      ]),
    ]);
    if (relations.some((result) => result.error)) throw new Error("staging_fixture_creation_failed");
    const publication = await client.from("submissions").update({
      status: "published", display_name: displayName, guardian_number: guardianNumber,
      submitted_at: approvedAt.toISOString(), approved_at: approvedAt.toISOString(), approved_by: admin.data.id,
      published_at: approvedAt.toISOString(),
    }).eq("id", submissionId);
    if (publication.error) throw new Error("staging_fixture_creation_failed");

    const generated = await processCertificateGeneration(submissionId);
    if (generated.outcome !== "generated") throw new Error("certificate_generation_not_completed");
    objectPath = generated.objectPath;
    const stored = await client.storage.from(CERTIFICATES_BUCKET).download(objectPath);
    if (stored.error || !stored.data) throw new Error("certificate_storage_verification_failed");
    const storedBytes = new Uint8Array(await stored.data.arrayBuffer());
    const pdf = await PDFDocument.load(storedBytes);
    if (pdf.getPageCount() !== 1 || !pdf.getTitle()?.includes(formatGuardianNumber(guardianNumber))) throw new Error("certificate_pdf_verification_failed");
    const expected = await generateCertificate({ displayName, guardianNumber, approvedAt });
    const metadata = await client.from("certificates").select("status,checksum_sha256,file_bytes,object_path").eq("id", certificateId).single();
    if (metadata.error || metadata.data.status !== "generated" || metadata.data.checksum_sha256 !== expected.sha256 || metadata.data.file_bytes !== expected.byteLength || metadata.data.object_path !== objectPath) throw new Error("certificate_metadata_verification_failed");
    if (formatCertificateDate(approvedAt) !== "07 August 2026") throw new Error("certificate_date_verification_failed");

    if (certificateOnly) {
      console.log(JSON.stringify({
        mode: "execute",
        certificate: "verified",
        privateStorage: "verified",
        email: "skipped",
        baselineCount,
      }));
      return;
    }

    const sent = await processEmailDelivery(deliveryId);
    if (sent.outcome !== "sent" || !sent.providerMessageId) throw new Error("email_smoke_not_sent");
    const firstState = await client.from("email_deliveries").select("status,provider_message_id,attempt_count,idempotency_key").eq("id", deliveryId).single();
    if (firstState.error || firstState.data.status !== "sent" || !firstState.data.provider_message_id) throw new Error("email_status_verification_failed");
    const retry = await processEmailDelivery(deliveryId);
    const retryState = await client.from("email_deliveries").select("status,provider_message_id,attempt_count,idempotency_key").eq("id", deliveryId).single();
    if (retry.outcome !== "not_eligible" || retryState.error || retryState.data.provider_message_id !== firstState.data.provider_message_id || retryState.data.attempt_count !== firstState.data.attempt_count || retryState.data.idempotency_key !== firstState.data.idempotency_key) throw new Error("duplicate_send_verification_failed");

    console.log(JSON.stringify({ mode: "execute", certificate: "verified", privateStorage: "verified", email: "sent", providerMessageIdRecorded: true, duplicateRetry: "blocked", baselineCount }));
  } finally {
    let cleanupFailed = false;
    if (objectPath) {
      const removal = await client.storage.from(CERTIFICATES_BUCKET).remove([objectPath]);
      cleanupFailed ||= Boolean(removal.error);
    }
    const remainingObjects = await client.storage.from(CERTIFICATES_BUCKET).list(submissionId);
    cleanupFailed ||= Boolean(remainingObjects.error || remainingObjects.data?.length);
    const deleted = await client.from("submissions").delete().eq("id", submissionId);
    cleanupFailed ||= Boolean(deleted.error);
    const fixture = await client.from("submissions").select("id").eq("id", submissionId).maybeSingle();
    cleanupFailed ||= Boolean(fixture.error || fixture.data);
    const restoredCount = await publicCount(client).catch(() => null);
    if (cleanupFailed || restoredCount !== baselineCount) throw new Error("staging_cleanup_failed");
  }
}

main().catch((error) => {
  console.error(safeFailure(error));
  process.exitCode = 1;
});
