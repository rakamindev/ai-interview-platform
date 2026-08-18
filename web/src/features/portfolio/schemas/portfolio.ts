import * as v from "valibot";

export const portfolioSkillSchema = v.object({
  id: v.number(),
  skill_id: v.nullable(v.number()),
  skill_label: v.string(),
  is_discovered: v.boolean(),
  ai_level: v.number(),
  ai_confidence: v.picklist(["high", "medium", "low"]),
  evidence: v.array(v.string()),
  competency_summary: v.string(),
});

export const assessorOverrideSchema = v.object({
  id: v.number(),
  portfolio_skill_id: v.number(),
  ai_level: v.number(),
  override_level: v.number(),
  assessor_notes: v.string(),
  overridden_by: v.nullable(v.number()),
  overridden_at: v.nullable(v.string()),
});

export const portfolioSchema = v.object({
  id: v.number(),
  session_id: v.number(),
  candidate_id: v.nullable(v.number()),
  generation_status: v.picklist(["pending", "generating", "complete", "failed"]),
  generated_at: v.nullable(v.string()),
  generation_error: v.nullable(v.string()),
  skills: v.array(portfolioSkillSchema),
  overrides: v.array(assessorOverrideSchema),
});

export const portfolioGeneratingResponseSchema = v.object({
  status: v.literal("generating"),
});

export const portfolioResponseSchema = v.object({
  portfolio: portfolioSchema,
  error: v.optional(v.string()),
});

export const portfolioResponseUnionSchema = v.union([
  portfolioGeneratingResponseSchema,
  portfolioResponseSchema,
]);

export const regeneratePortfolioResponseSchema = v.object({
  message: v.string(),
  portfolio: portfolioSchema,
});

export const overridePayloadSchema = v.object({
  override_level: v.number(),
  assessor_notes: v.string(),
});

export const overrideResponseSchema = v.object({
  override: assessorOverrideSchema,
});

export type PortfolioSkill = v.InferOutput<typeof portfolioSkillSchema>;
export type AssessorOverride = v.InferOutput<typeof assessorOverrideSchema>;
export type Portfolio = v.InferOutput<typeof portfolioSchema>;
export type PortfolioResponse = v.InferOutput<typeof portfolioResponseUnionSchema>;
export type RegeneratePortfolioResponse = v.InferOutput<typeof regeneratePortfolioResponseSchema>;
export type OverridePayload = v.InferOutput<typeof overridePayloadSchema>;
export type OverrideResponse = v.InferOutput<typeof overrideResponseSchema>;
