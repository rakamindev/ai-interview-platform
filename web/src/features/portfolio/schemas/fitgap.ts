import * as v from "valibot";

export const skillComparisonSchema = v.object({
  skill_label: v.string(),
  skill_id: v.nullable(v.string()),
  expected_level: v.number(),
  candidate_level: v.nullable(v.number()),
  result: v.picklist(["match", "gap", "exceed", "not_assessed"]),
  delta: v.nullable(v.number()),
  confidence: v.nullable(v.string()),
  is_override: v.boolean(),
  caveat: v.nullable(v.string()),
});

export const fitGapSummarySchema = v.object({
  match_count: v.number(),
  exceed_count: v.number(),
  gap_count: v.number(),
  not_assessed_count: v.number(),
  priority_gaps: v.array(v.string()),
});

export const additionalSkillSignalSchema = v.object({
  skill_id: v.optional(v.nullable(v.string())),
  skill_label: v.string(),
  candidate_level: v.optional(v.nullable(v.number())),
  confidence: v.optional(v.nullable(v.string())),
  is_override: v.optional(v.boolean()),
  caveat: v.optional(v.nullable(v.string())),
});

export const fitGapReportSchema = v.object({
  id: v.number(),
  portfolio_id: v.number(),
  vacancy_id: v.number(),
  skill_comparisons: v.array(skillComparisonSchema),
  summary: v.optional(fitGapSummarySchema),
  caveats: v.optional(v.array(v.string())),
  additional_skill_signals: v.optional(v.array(additionalSkillSignalSchema)),
  culture_narrative: v.nullable(v.string()),
  overall_narrative: v.nullable(v.string()),
  narrative_status: v.optional(v.picklist(["pending", "generating", "complete", "failed"])),
  narrative_error: v.optional(v.nullable(v.string())),
  generated_at: v.nullable(v.string()),
});

// Accepts both `{ report }` (cached/completed) and 202 `{ status, message, report }`
export const fitGapReportResponseSchema = v.object({
  report: fitGapReportSchema,
  status: v.optional(v.string()),
  message: v.optional(v.string()),
});

export type SkillComparison = v.InferOutput<typeof skillComparisonSchema>;
export type FitGapSummary = v.InferOutput<typeof fitGapSummarySchema>;
export type AdditionalSkillSignal = v.InferOutput<typeof additionalSkillSignalSchema>;
export type FitGapReport = v.InferOutput<typeof fitGapReportSchema>;
export type FitGapReportResponse = v.InferOutput<typeof fitGapReportResponseSchema>;
