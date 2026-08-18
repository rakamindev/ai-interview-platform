import { z } from "zod";

export const vacancySkillSchema = z.object({
  id: z.number().optional(), // For existing skills
  skill_id: z.number().optional().nullable(), // For B7 taxonomy skills
  skill_label: z.string().trim().optional(), // Base is optional
  expected_level: z.number().min(1).max(5), // Assuming levels are 1-5
  _destroy: z.boolean().optional(), // For deletion
});

export const vacancySchema = z.object({
  role_title: z
    .string()
    .trim()
    .min(1, { message: "Role title is required." })
    .max(128, { message: "Maximum 128 characters allowed." }),
  culture_dimensions: z.string().trim().optional(),
  competency_expectations: z.string().trim().optional(),
  skills: z
    .array(vacancySkillSchema)
    .min(1, { message: "Add at least one skill expectation." }),
});