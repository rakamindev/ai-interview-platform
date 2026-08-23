import { z } from "zod";

export const SkillComparisonResultSchema = z.enum([
  "match",
  "gap",
  "exceed",
  "insufficient_evidence",
  "not_assessed"
]);

export const SkillComparisonSchema = z.object({
  skill_id: z.string().nullable().optional(),
  skill_label: z.string(),
  expected_level: z.number(),
  effective_level: z.number().nullable().optional(),
  level_source: z.string().optional(),
  candidate_level: z.number().nullable().optional(),
  ai_level: z.number().nullable().optional(),
  result: SkillComparisonResultSchema,
  delta: z.number().nullable().optional(),
  confidence: z.string().nullable().optional(),
  is_override: z.boolean().optional(),
  override_actor: z.string().nullable().optional(),
  override_reason: z.string().nullable().optional(),
  override_at: z.string().nullable().optional(),
  schema_version: z.number().optional()
});

export type SkillComparisonResult = z.infer<typeof SkillComparisonResultSchema>;
export type SkillComparison = z.infer<typeof SkillComparisonSchema>;
