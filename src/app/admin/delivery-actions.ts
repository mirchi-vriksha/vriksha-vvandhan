"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireRole } from "@/lib/auth/dal";
import { processCertificateGeneration } from "@/lib/certificates/process-certificate.server";
import { processEmailDelivery } from "@/lib/email/process-email-delivery.server";
import { isStaffE2EAdapterEnabled } from "@/lib/testing/staff-adapter";

const idSchema = z.uuid();

export async function retryCertificateAction(formData: FormData) {
  await requireRole("admin");
  const submissionId = idSchema.parse(formData.get("submissionId"));
  if (!isStaffE2EAdapterEnabled()) {
    await processCertificateGeneration(submissionId, { allowExhaustedRetry: true });
  }
  revalidatePath("/admin/deliveries");
  redirect("/admin/deliveries?result=certificate_retry");
}

export async function regenerateCertificateAction(formData: FormData) {
  await requireRole("admin");
  const submissionId = idSchema.parse(formData.get("submissionId"));
  if (formData.get("confirmation") !== "REGENERATE") throw new Error("regeneration_confirmation_required");
  if (!isStaffE2EAdapterEnabled()) await processCertificateGeneration(submissionId, { forceRegeneration: true });
  revalidatePath("/admin/deliveries");
  redirect("/admin/deliveries?result=certificate_regenerated");
}

export async function retryEmailAction(formData: FormData) {
  await requireRole("admin");
  const deliveryId = idSchema.parse(formData.get("deliveryId"));
  if (!isStaffE2EAdapterEnabled()) {
    await processEmailDelivery(deliveryId, {}, { allowExhaustedRetry: true });
  }
  revalidatePath("/admin/deliveries");
  redirect("/admin/deliveries?result=email_retry");
}
