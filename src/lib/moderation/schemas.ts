import { z } from "zod";

export const submissionIdSchema = z.uuid();
export const reviewFieldsSchema = z.object({
  submissionId: submissionIdSchema,
  displayName: z.string().trim().min(1).max(100),
  focalX: z.coerce.number().min(0).max(1),
  focalY: z.coerce.number().min(0).max(1),
});
export const rejectionSchema = z.object({ submissionId: submissionIdSchema, comment: z.string().trim().min(10).max(1200) });
export const deletionSchema = z.object({ submissionId: submissionIdSchema, reason: z.string().trim().min(10).max(1200), confirmation: z.literal("DELETE") });
