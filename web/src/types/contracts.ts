import { z } from "zod";

const level = z.number().int().min(1).max(5).nullable();

export const skillComparisonSchema = z.object({
  skill_label: z.string(),
  skill_id: z.string().nullable().optional(),
  candidate_level: level,
  expected_level: level,
  result: z.enum(["match", "gap", "exceed", "not_assessed"]),
  delta: z.number().int().nullable(),
  confidence: z.enum(["high", "medium", "low"]).nullable().optional(),
  is_override: z.boolean(),
});

export const fitGapReportSchema = z.object({
  id: z.number().int(),
  portfolio_id: z.number().int(),
  vacancy_id: z.number().int(),
  skill_comparisons: z.array(skillComparisonSchema),
  culture_narrative: z.string().nullable(),
  overall_narrative: z.string().nullable(),
  generated_at: z.string(),
});

export const fitGapResponseSchema = z.union([
  z.object({ report: fitGapReportSchema }),
  z.object({
    status: z.enum(["generating", "failed"]),
    error: z.string().optional(),
    stale_report: fitGapReportSchema.nullable().optional(),
  }),
]);
