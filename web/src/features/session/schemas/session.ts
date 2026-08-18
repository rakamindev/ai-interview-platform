import * as v from "valibot";

export const sessionEndReasonSchema = v.picklist([
  "manual_candidate",
  "manual_assessor",
  "all_covered",
  "time_ceiling",
  "error",
]);

export const sessionSchema = v.object({
  id: v.number(),
  assessment_id: v.number(),
  tenant_id: v.nullable(v.number()),
  candidate_id: v.nullable(v.number()),
  candidate_name: v.nullable(v.string()),
  invite_token: v.string(),
  invite_url: v.string(),
  status: v.picklist(["pending", "active", "ended", "failed"]),
  end_reason: v.nullable(sessionEndReasonSchema),
  started_at: v.nullable(v.string()),
  ended_at: v.nullable(v.string()),
  duration_seconds: v.nullable(v.number()),
  created_at: v.string(),
});

export const sessionDetailSchema = v.object({
  ...sessionSchema.entries,
  assessment: v.object({
    id: v.number(),
    name: v.string(),
    time_limit_min: v.number(),
  }),
});

export type SessionEndReason = v.InferOutput<typeof sessionEndReasonSchema>;
export type Session = v.InferOutput<typeof sessionSchema>;
export type SessionDetail = v.InferOutput<typeof sessionDetailSchema>;

export const coverageSkillSchema = v.object({
  id: v.number(),
  skill_id: v.number(),
  skill_label: v.string(),
  is_discovered: v.boolean(),
  state: v.picklist(["not_yet", "initiated", "partial", "covered"]),
  probe_count: v.number(),
  last_signal: v.nullable(v.string()),
  updated_at: v.nullable(v.string()),
});

export const coverageMapSchema = v.object({
  skills: v.array(coverageSkillSchema),
  discovered: v.array(coverageSkillSchema),
  updated_at: v.optional(v.nullable(v.string())),
});

export const transcriptTurnSchema = v.object({
  id: v.number(),
  turn_number: v.number(),
  speaker: v.picklist(["candidate", "ai", "assessor", "system"]),
  text: v.string(),
  audio_start_ms: v.nullable(v.number()),
  audio_end_ms: v.nullable(v.number()),
  created_at: v.string(),
});

export const transcriptResponseSchema = v.object({
  turns: v.array(transcriptTurnSchema),
  total: v.number(),
});

export type CoverageSkill = v.InferOutput<typeof coverageSkillSchema>;
export type CoverageMap = v.InferOutput<typeof coverageMapSchema>;
export type TranscriptTurn = v.InferOutput<typeof transcriptTurnSchema>;
export type TranscriptResponse = v.InferOutput<typeof transcriptResponseSchema>;
