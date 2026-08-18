import { z } from "zod";

export const SkillComparisonResultSchema = z.enum([
  "match",
  "gap",
  "exceed",
  "not_assessed",
]);

export const SkillComparisonSchema = z.object({
  skill_label: z.string(),
  expected_level: z.number(),
  candidate_level: z.number().nullable().optional(),
  result: SkillComparisonResultSchema,
  delta: z.number().nullable().optional(),
  is_override: z.boolean().optional(),
});

export type SkillComparisonResult = z.infer<typeof SkillComparisonResultSchema>;
export type SkillComparison = z.infer<typeof SkillComparisonSchema>;
