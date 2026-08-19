import { z } from "zod";

import { MINIMUM_STAFF_PASSWORD_LENGTH } from "@/lib/auth/password-recovery";

export const createStaffMemberSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .transform((value) => value.replace(/\s+/g, " ")),
  email: z
    .preprocess(
      (value) => typeof value === "string" ? value.trim() : value,
      z.email().max(254),
    )
    .transform((value) => value.trim().toLowerCase()),
  password: z
    .string()
    .min(MINIMUM_STAFF_PASSWORD_LENGTH)
    .max(256),
  role: z.enum(["admin", "reviewer"]),
  active: z.boolean(),
});

export type CreateStaffMemberInput = z.infer<typeof createStaffMemberSchema>;
