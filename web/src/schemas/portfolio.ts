import { z } from "zod";

export const PortfolioSkillSchema = z.object({
  id: z.number(),
  skill_id: z.string().nullable().optional(),
  skill_label: z.string(),
  is_discovered: z.boolean(),
  ai_level: z.number(),
  ai_confidence: z.string(),
  evidence: z.array(z.string()),
  competency_summary: z.string()
});

export const AssessorOverrideSchema = z.object({
  id: z.number(),
  portfolio_skill_id: z.number(),
  ai_level: z.number(),
  override_level: z.number(),
  assessor_notes: z.string(),
  overridden_by: z.number().nullable().optional(),
  overridden_at: z.string().nullable().optional()
});

export const PortfolioSchema = z.object({
  id: z.number(),
  session_id: z.number(),
  candidate_id: z.number().nullable().optional(),
  generation_status: z.enum(["pending", "generating", "complete", "failed"]),
  generated_at: z.string().nullable().optional(),
  generation_error: z.string().nullable().optional(),
  skills: z.array(PortfolioSkillSchema),
  overrides: z.array(AssessorOverrideSchema)
});

export type Portfolio = z.infer<typeof PortfolioSchema>;
export type PortfolioSkill = z.infer<typeof PortfolioSkillSchema>;
export type AssessorOverride = z.infer<typeof AssessorOverrideSchema>;
