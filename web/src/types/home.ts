import type { SkillStatus } from "@/types";

// GET /api/v1/home — the review desk. Each section can fail on its own.
export type Section<T> = { status: "ok"; data: T } | { status: "error" };

export interface DeskAssessment {
  id: number;
  name: string;
}

export interface HomeSummary {
  failed_needing_reinvite: number;
  stuck_reports: number;
  needs_look_7d: number;
  live: number;
  stale_live: number;
  last_result_at: string | null;
  new_results?: number;
  new_needs_look?: number;
}

export type NeedsYouItem =
  | { type: "failed_interview"; session_id: number; reference: string; candidate_name: string | null;
      assessment: DeskAssessment; ended_at: string | null; duration_seconds: number | null; turns: number }
  | { type: "stuck_report"; session_id: number; reference: string; candidate_name: string | null;
      assessment: DeskAssessment; state: string; since: string; failure_kind: string | null; can_retry: boolean }
  | { type: "needs_look_group"; count: number; partial_count: number };

export interface LiveItem {
  session_id: number;
  candidate_name: string | null;
  assessment: DeskAssessment;
  started_at: string | null;
  time_limit_min: number;
  stale: boolean;
}

export interface ResultItem {
  session_id: number;
  reference: string;
  candidate_name: string | null;
  assessment: DeskAssessment;
  state: "complete" | "partial";
  generated_at: string;
  duration_seconds: number | null;
  skill_statuses: SkillStatus[];
  new: boolean;
}

export interface HomeDesk {
  generated_at: string;
  summary: Section<HomeSummary>;
  needs_you: Section<{ total: number; items: NeedsYouItem[] }>;
  live: Section<LiveItem[]>;
  results: Section<{ total: number; items: ResultItem[] }>;
}
