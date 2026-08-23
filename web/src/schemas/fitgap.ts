import { z } from "zod";
import { SkillComparisonSchema } from "./comparison";

export const AdditionalStrengthSchema = z.object({
  skill_id: z.string().nullable().optional(),
  skill_label: z.string(),
  ai_level: z.number().nullable().optional(),
  effective_level: z.number().nullable().optional(),
  level_source: z.string().optional(),
  confidence: z.string().nullable().optional(),
  is_override: z.boolean().optional(),
  schema_version: z.number().optional()
});

export const FitGapReportSchema = z.object({
  id: z.number(),
  portfolio_id: z.number(),
  vacancy_id: z.number(),
  skill_comparisons: z.array(SkillComparisonSchema),
  additional_strengths: z.array(AdditionalStrengthSchema).optional(),
  // The generation prompt can fail to produce a narrative (see FitGap::Engine's
  // rescue path), in which case the backend persists nil rather than "".
  culture_narrative: z.string().nullable().optional(),
  overall_narrative: z.string().nullable().optional(),
  generated_at: z.string(),
  schema_version: z.number().nullable().optional()
});

export type FitGapReport = z.infer<typeof FitGapReportSchema>;
