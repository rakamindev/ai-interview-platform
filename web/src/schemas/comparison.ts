import { z } from "zod";

export const SkillComparisonResultSchema = z.enum([
  "match",
  "gap",
  "exceed",
  "insufficient_evidence",
  "not_assessed",
]);

export const SkillComparisonSchema = z.object({
  skill_label: z.string(),
  expected_level: z.number(),
  effective_level: z.number().nullable().optional(),
  level_source: z.string().optional(),
  candidate_level: z.number().nullable().optional(),
  result: SkillComparisonResultSchema,
  delta: z.number().nullable().optional(),
  confidence: z.string().optional(),
  is_override: z.boolean().optional(),
  override_actor: z.string().optional(),
  override_reason: z.string().optional(),
  override_at: z.string().optional(),
});

export type SkillComparisonResult = z.infer<typeof SkillComparisonResultSchema>;
export type SkillComparison = z.infer<typeof SkillComparisonSchema>;
