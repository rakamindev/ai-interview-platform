import * as v from "valibot";

import { sessionSchema } from "@/features/session/schemas/session";
import { skillTaxonomySchema } from "@/features/skill-taxonomy/schemas/skill-taxonomy";
import { paginatedList, paginatedParams } from "@/utils/type";

export const latestSessionSchema = v.object({
  id: v.number(),
  status: v.picklist(["pending", "active", "ended", "failed"]),
  end_reason: v.picklist(["manual_candidate", "manual_assessor", "all_covered", "time_ceiling", "error"]),
});

export const assessmentSchema = v.object({
  id: v.number(),
  name: v.string(),
  time_limit_min: v.number(),
  language: v.picklist(["en", "id"]),
  system_prompt: v.string(),
  created_by: v.number(),
  created_at: v.string(),
  updated_at: v.string(),
  skills_count: v.number(),
  candidates_count: v.number(),
  latest_session: v.nullable(latestSessionSchema),
});

export const assessmentListSchema = paginatedList("assessments", assessmentSchema);

export const assessmentSearchSchema = paginatedParams();

export const assessmentSkillSchema = v.object({
  ...v.omit(skillTaxonomySchema, ["skill_id", "category"]).entries,
  id: v.optional(v.number()),
  skill_id: v.nullable(v.string()),
  expected_level: v.number(),
  is_custom: v.fallback(v.boolean(), false),
  display_order: v.number(),
  _destroy: v.optional(v.boolean()),
});

export const assessmentDetailSchema = v.object({
  ...assessmentSchema.entries,
  skills: v.array(assessmentSkillSchema),
});

export const sessionListSchema = v.object({
  sessions: v.array(sessionSchema),
});

export const createAssessmentSchema = v.object({
  name: v.string(),
  time_limit_min: v.number(),
  language: v.picklist(["en", "id"]),
  assessment_skills_attributes: v.pipe(v.array(assessmentSkillSchema), v.minLength(1)),
});

export const createSessionSchema = v.object({
  candidate_name: v.optional(v.string()),
  candidate_id: v.optional(v.number()),
});

export const createSessionResponseSchema = v.object({
  session: sessionSchema,
  invite_url: v.string(),
});

export type LatestSession = v.InferOutput<typeof latestSessionSchema>;
export type Assessment = v.InferOutput<typeof assessmentSchema>;
export type AssessmentList = v.InferOutput<typeof assessmentListSchema>;
export type AssessmentSearch = v.InferOutput<typeof assessmentSearchSchema>;
export type AssessmentSkill = v.InferOutput<typeof assessmentSkillSchema>;
export type CreateAssessment = v.InferOutput<typeof createAssessmentSchema>;
export type CreateSession = v.InferOutput<typeof createSessionSchema>;
export type CreateSessionResponse = v.InferOutput<typeof createSessionResponseSchema>;
export type AssessmentDetail = v.InferOutput<typeof assessmentDetailSchema>;
export type SessionList = v.InferOutput<typeof sessionListSchema>;
