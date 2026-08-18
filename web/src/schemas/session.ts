import { z } from "zod";

export const SessionSchema = z.object({
  id: z.number(),
  assessment_id: z.number(),
  tenant_id: z.number().nullable().optional(),
  candidate_id: z.number().nullable().optional(),
  candidate_name: z.string().nullable().optional(),
  invite_token: z.string(),
  invite_url: z.string(),
  status: z.enum(["pending", "active", "ended"]),
  end_reason: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  ended_at: z.string().nullable().optional(),
  duration_seconds: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
});

export const CoverageSkillSchema = z.object({
  id: z.number(),
  skill_id: z.number(),
  skill_label: z.string(),
  is_discovered: z.boolean(),
  state: z.enum(["not_yet", "initiated", "partial", "covered"]),
  probe_count: z.number(),
  last_signal: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

export const CoverageMapSchema = z.object({
  skills: z.array(CoverageSkillSchema),
  discovered: z.array(CoverageSkillSchema),
  updated_at: z.string().nullable().optional(),
});

export const TranscriptTurnSchema = z.object({
  id: z.number(),
  turn_number: z.number(),
  speaker: z.enum(["candidate", "ai", "assessor", "system"]),
  text: z.string(),
  audio_start_ms: z.number().nullable().optional(),
  audio_end_ms: z.number().nullable().optional(),
  created_at: z.string(),
});

export const CandidateInfoSchema = z.object({
  session_id: z.number(),
  role_title: z.string(),
  time_limit_min: z.number(),
  session_status: z.string(),
});

export type Session = z.infer<typeof SessionSchema>;
export type CoverageSkill = z.infer<typeof CoverageSkillSchema>;
export type CoverageMap = z.infer<typeof CoverageMapSchema>;
export type TranscriptTurn = z.infer<typeof TranscriptTurnSchema>;
export type CandidateInfo = z.infer<typeof CandidateInfoSchema>;
