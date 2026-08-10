import { z } from "zod";

import { PUBLIC_SUBMISSION } from "@/config/public-submission";

export const displayNameSchema = z
  .string()
  .transform((value) => value.trim().replace(/\s+/gu, " "))
  .pipe(
    z
      .string()
      .min(1, "Enter your display name.")
      .max(PUBLIC_SUBMISSION.displayNameMax, "Display name must be 100 characters or fewer."),
  );

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(PUBLIC_SUBMISSION.emailMax, "Email address must be 254 characters or fewer.")
  .pipe(z.email("Enter a valid email address."));

export const consentSchema = z.object({
  publicationConsent: z.literal(true, { error: "Publication consent is required." }),
  termsAccepted: z.literal(true, { error: "You must accept the campaign terms." }),
});

export const requestTokenSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "The secure submission session is invalid.");

export const preparedExtensionSchema = z.enum(["webp", "jpg"]);

export const turnstileTokenSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .optional();

export const prepareSubmissionRequestSchema = z
  .object({
    displayName: displayNameSchema,
    email: emailSchema,
    publicationConsent: z.literal(true),
    termsAccepted: z.literal(true),
    requestToken: requestTokenSchema,
    preparedExtension: preparedExtensionSchema,
    turnstileToken: turnstileTokenSchema,
  })
  .strict();

export const storageDescriptorSchema = z
  .object({
    bucket: z.literal("submission-originals"),
    path: z.string().min(1).max(500),
    token: z.string().min(1).max(4096),
  })
  .strict();

export const prepareSubmissionResponseSchema = z
  .object({
    submissionId: z.uuid(),
    status: z.enum(["draft", "pending_review"]),
    draftExpiresAt: z.iso.datetime(),
    uploadRequired: z.boolean(),
    upload: storageDescriptorSchema.optional(),
  })
  .strict()
  .refine((value) => value.uploadRequired === Boolean(value.upload), {
    message: "Signed upload details do not match the upload state.",
  });

export const finalizeSubmissionRequestSchema = z
  .object({
    submissionId: z.uuid(),
    requestToken: requestTokenSchema,
  })
  .strict();

export const finalizeSubmissionResponseSchema = z
  .object({
    success: z.literal(true),
    status: z.literal("pending_review"),
  })
  .strict();

export const publicApiErrorCodeSchema = z.enum([
  "invalid_request",
  "submissions_closed",
  "submission_limit_reached",
  "rate_limited",
  "verification_failed",
  "draft_expired",
  "invalid_draft",
  "consent_required",
  "media_not_ready",
  "invalid_image",
  "already_submitted",
  "temporarily_unavailable",
]);

export const publicApiErrorSchema = z
  .object({
    success: z.literal(false),
    code: publicApiErrorCodeSchema,
    message: z.string().min(1).max(240),
    retryable: z.boolean(),
  })
  .strict();

export type PrepareSubmissionRequest = z.infer<typeof prepareSubmissionRequestSchema>;
export type PrepareSubmissionResponse = z.infer<typeof prepareSubmissionResponseSchema>;
export type FinalizeSubmissionRequest = z.infer<typeof finalizeSubmissionRequestSchema>;
export type FinalizeSubmissionResponse = z.infer<typeof finalizeSubmissionResponseSchema>;
export type PublicApiError = z.infer<typeof publicApiErrorSchema>;
export type PublicApiErrorCode = z.infer<typeof publicApiErrorCodeSchema>;
