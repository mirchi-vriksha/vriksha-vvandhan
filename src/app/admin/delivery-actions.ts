"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireRole } from "@/lib/auth/dal";
import { processCertificateGeneration } from "@/lib/certificates/process-certificate.server";
import { processEmailDelivery } from "@/lib/email/process-email-delivery.server";
import { callUntypedRpc } from "@/lib/supabase/rpc.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isStaffE2EAdapterEnabled } from "@/lib/testing/staff-adapter";

const idSchema = z.uuid();

export async function retryCertificateAction(formData: FormData) {
  await requireRole("admin");
  const submissionId = idSchema.parse(formData.get("submissionId"));
  if (!isStaffE2EAdapterEnabled()) {
    const client = await createServerSupabaseClient();
    const audit = await callUntypedRpc(client, "record_delivery_admin_action", { p_delivery_id: submissionId, p_action: "certificate.retry" });
    if (audit.error) throw new Error("delivery_audit_failed");
    await processCertificateGeneration(submissionId, { allowExhaustedRetry: true });
  }
  revalidatePath("/admin/deliveries");
  redirect("/admin/deliveries?result=certificate_retry");
}

export async function regenerateCertificateAction(formData: FormData) {
  await requireRole("admin");
  const submissionId = idSchema.parse(formData.get("submissionId"));
  if (formData.get("confirmation") !== "REGENERATE") throw new Error("regeneration_confirmation_required");
  if (!isStaffE2EAdapterEnabled()) {
    const client = await createServerSupabaseClient();
    const audit = await callUntypedRpc(client, "record_delivery_admin_action", { p_delivery_id: submissionId, p_action: "certificate.regenerate" });
    if (audit.error) throw new Error("delivery_audit_failed");
    await processCertificateGeneration(submissionId, { forceRegeneration: true });
  }
  revalidatePath("/admin/deliveries");
  redirect("/admin/deliveries?result=certificate_regenerated");
}

export async function retryEmailAction(formData: FormData) {
  await requireRole("admin");
  const deliveryId = idSchema.parse(formData.get("deliveryId"));
  if (!isStaffE2EAdapterEnabled()) {
    const client = await createServerSupabaseClient();
    const prepared = await callUntypedRpc<boolean>(client, "prepare_email_admin_retry", { p_delivery_id: deliveryId });
    if (prepared.error || prepared.data !== true) throw new Error("email_retry_not_available");
    await processEmailDelivery(deliveryId, {}, { allowExhaustedRetry: true });
  }
  revalidatePath("/admin/deliveries");
  redirect("/admin/deliveries?result=email_retry");
}
