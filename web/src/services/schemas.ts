import { z } from "zod";

/**
 * Runtime validation for API payloads.
 *
 * The Required column in the fit/gap table rendered blank on every row for as
 * long as this feature existed, because the backend sent `expected_level` and
 * the client read `required_level`. TypeScript could not catch it: the
 * interface declared the field, and an axios response is cast rather than
 * checked, so the compiler was satisfied by a value that never arrived.
 *
 * Parsing here converts that silent blank into a loud failure. That is the
 * structural fix — the original bug survived to production precisely because
 * its symptom was an empty cell rather than an error.
 */

export class ContractError extends Error {
  constructor(
    readonly context: string,
    readonly issues: string[],
  ) {
    super(`Unexpected ${context} payload from the API: ${issues.join("; ")}`);
    this.name = "ContractError";
  }
}

const confidence = z.enum(["high", "medium", "low"]);
const assessmentState = z.enum(["assessed", "insufficient_evidence", "not_probed"]);
const level = z.number().int().min(1).max(5);

export const skillComparisonSchema = z.object({
  skill_label: z.string(),
  skill_id: z.string().nullable().default(null),
  required_level: level.nullable(),
  expected_level: level.nullable().optional(),
  candidate_level: level.nullable(),
  ai_level: level.nullable().default(null),
  override_level: level.nullable().default(null),
  is_override: z.boolean().default(false),
  confidence: confidence.nullable().default(null),
  assessment_state: assessmentState.default("assessed"),
  result: z.enum(["match", "gap", "exceed", "not_assessed", "additional"]),
  delta: z.number().int().nullable(),
  in_vacancy: z.boolean().default(true),
  is_discovered: z.boolean().optional(),
});

export const fitGapReportSchema = z.object({
  id: z.number(),
  portfolio_id: z.number(),
  vacancy_id: z.number(),
  skill_comparisons: z.array(skillComparisonSchema),
  culture_narrative: z.string().nullable(),
  overall_narrative: z.string().nullable(),
  narrative_status: z.enum(["complete", "failed", "skipped"]).default("complete"),
  generated_at: z.string(),
});

export const portfolioSkillSchema = z.object({
  id: z.number(),
  skill_id: z.string().nullable().default(null),
  skill_label: z.string(),
  is_discovered: z.boolean(),
  assessment_state: assessmentState.default("assessed"),
  ai_level: level.nullable(),
  ai_confidence: confidence.nullable(),
  effective_level: level.nullable().default(null),
  is_override: z.boolean().default(false),
  superseded_at: z.string().nullable().optional(),
  evidence: z.array(z.string()).default([]),
  competency_summary: z.string(),
});

export const portfolioSchema = z.object({
  id: z.number(),
  session_id: z.number(),
  generation_status: z.enum(["pending", "generating", "complete", "failed"]),
  generated_at: z.string().nullable().optional(),
  generation_error: z.string().nullable().optional(),
  skills: z.array(portfolioSkillSchema).default([]),
});

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, context: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const issues = result.error.issues.map(
    (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
  );
  throw new ContractError(context, issues);
}
