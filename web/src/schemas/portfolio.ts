import { z } from "zod";

const portfolioSkillSchema = z.object({
  id: z.number(),
  skill_id: z.string().nullable().optional(),
  skill_label: z.string(),
  is_discovered: z.boolean(),
  ai_level: z.number().int().min(1).max(5),
  ai_confidence: z.enum(["high", "medium", "low"]),
  evidence: z.array(z.string()),
  competency_summary: z.string(),
}).passthrough();

const overrideSchema = z.object({
  id: z.number(),
  portfolio_skill_id: z.number(),
  ai_level: z.number().int().min(1).max(5),
  override_level: z.number().int().min(1).max(5),
  assessor_notes: z.string(),
}).passthrough();

export const portfolioSchema = z.object({
  id: z.number(),
  session_id: z.number(),
  generation_status: z.enum(["pending", "generating", "complete", "failed"]),
  skills: z.array(portfolioSkillSchema),
  overrides: z.array(overrideSchema),
}).passthrough();

const comparisonSchema = z.object({
  skill_label: z.string(),
  skill_id: z.string().nullable().optional(),
  required_level: z.number().int().min(1).max(5),
  candidate_level: z.number().int().min(1).max(5).nullable(),
  result: z.enum(["match", "gap", "exceed", "not_assessed"]),
  delta: z.number().int().nullable(),
  is_override: z.boolean(),
}).passthrough();

export const fitGapReportSchema = z.object({
  id: z.number(),
  portfolio_id: z.number(),
  vacancy_id: z.number(),
  skill_comparisons: z.array(comparisonSchema),
  override_context: z.array(z.object({
    skill_label: z.string(),
    skill_id: z.string().nullable().optional(),
    ai_level: z.number().int().min(1).max(5),
    override_level: z.number().int().min(1).max(5),
  }).passthrough()),
  culture_narrative: z.string().nullable(),
  overall_narrative: z.string().nullable(),
  generated_at: z.string(),
}).passthrough();
