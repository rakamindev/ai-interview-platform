import { z } from "zod";

export const inviteSchema = z.object({
  candidate_name: z
    .string()
    .max(128, { message: "Candidate name must be 128 characters or less." })
    .optional(),
});