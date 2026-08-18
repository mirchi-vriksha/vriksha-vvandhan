import "server-only";

import { processCertificateGeneration } from "@/lib/certificates/process-certificate.server";
import { processEmailDelivery } from "@/lib/email/process-email-delivery.server";
import { getEmailConfiguration } from "@/lib/email/config.server";
import { callUntypedRpc } from "@/lib/supabase/rpc.server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

type WorkId = { submission_id?: string; delivery_id?: string };

export type DeliveryCatchUpResult = {
  staleCertificatesRecovered: number;
  staleEmailsRecovered: number;
  certificatesAttempted: number;
  certificatesGenerated: number;
  certificateFailures: number;
  emailsAttempted: number;
  emailsSent: number;
  emailsDisabled: number;
  emailFailures: number;
};

export async function processDeliveryBacklog(batchSize?: number): Promise<DeliveryCatchUpResult> {
  const configuredBatchSize = getEmailConfiguration().batchSize;
  const limit = Math.min(Math.max(Math.trunc(batchSize ?? configuredBatchSize), 1), 25);
  const service = getServiceSupabaseClient();
  const workerRun = await callUntypedRpc<string>(service, "begin_email_worker_run");
  if (workerRun.error || !workerRun.data) throw new Error("worker_run_start_failed");
  const runId = workerRun.data;
  try {
    const recovered = await callUntypedRpc<Array<{
      certificates_recovered: number;
      emails_recovered: number;
    }>>(service, "recover_stale_delivery_claims", { p_stale_minutes: 15 });
    if (recovered.error) throw new Error("stale_delivery_recovery_failed");

    const result: DeliveryCatchUpResult = {
      staleCertificatesRecovered: recovered.data?.[0]?.certificates_recovered ?? 0,
      staleEmailsRecovered: recovered.data?.[0]?.emails_recovered ?? 0,
      certificatesAttempted: 0,
      certificatesGenerated: 0,
      certificateFailures: 0,
      emailsAttempted: 0,
      emailsSent: 0,
      emailsDisabled: 0,
      emailFailures: 0,
    };

    const certificates = await callUntypedRpc<WorkId[]>(service, "list_due_certificate_work", {
      p_limit: limit,
    });
    if (certificates.error) throw new Error("certificate_backlog_lookup_failed");
    for (const work of certificates.data ?? []) {
      if (!work.submission_id) continue;
      result.certificatesAttempted += 1;
      try {
        const outcome = await processCertificateGeneration(work.submission_id);
        if (outcome.outcome === "generated") result.certificatesGenerated += 1;
      } catch {
        result.certificateFailures += 1;
      }
    }

    const emails = await callUntypedRpc<WorkId[]>(service, "list_due_email_work", {
      p_limit: limit,
    });
    if (emails.error) throw new Error("email_backlog_lookup_failed");
    for (const work of emails.data ?? []) {
      if (!work.delivery_id) continue;
      result.emailsAttempted += 1;
      try {
        const outcome = await processEmailDelivery(work.delivery_id);
        if (outcome.outcome === "sent") result.emailsSent += 1;
        if (outcome.outcome === "disabled") result.emailsDisabled += 1;
      } catch {
        result.emailFailures += 1;
      }
    }
    const completion = await callUntypedRpc<boolean>(service, "complete_email_worker_run", {
      p_run_id: runId,
      p_outcome: "succeeded",
      p_processed_count: result.emailsAttempted,
      p_sent_count: result.emailsSent,
      p_failed_count: result.emailFailures,
      p_error_code: null,
    });
    if (completion.error || completion.data !== true) throw new Error("worker_run_completion_failed");
    return result;
  } catch (error) {
    await callUntypedRpc(service, "complete_email_worker_run", {
      p_run_id: runId,
      p_outcome: "failed",
      p_processed_count: 0,
      p_sent_count: 0,
      p_failed_count: 0,
      p_error_code: "worker_run_failed",
    }).catch(() => undefined);
    throw error;
  }
}
