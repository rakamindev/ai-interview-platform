export interface Assessment {
  id: number;
  name: string;
  time_limit_min: number;
  language?: "en" | "id";
  system_prompt?: string;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  skills?: AssessmentSkill[];
  latest_session?: {
    status: "pending" | "active" | "ended";
    end_reason?: string | null;
  };
}

export interface AssessmentSkill {
  id?: number;
  skill_id?: number;
  skill_label: string;
  is_custom: boolean;
  expected_level: number;
  display_order: number;
  scope_include?: string;
  scope_exclude?: string;
  l1_anchor?: string;
  l2_anchor?: string;
  l3_anchor?: string;
  l4_anchor?: string;
  l5_anchor?: string;
  _destroy?: boolean;
}

export interface Session {
  id: number;
  assessment_id: number;
  tenant_id?: number;
  candidate_id?: number;
  candidate_name?: string;
  invite_token: string;
  invite_url: string;
  status: "pending" | "active" | "ended";
  end_reason?: string;
  started_at?: string;
  ended_at?: string;
  duration_seconds?: number;
  created_at?: string;
}

export interface CoverageSkill {
  id: number;
  skill_id: number;
  skill_label: string;
  is_discovered: boolean;
  state: "not_yet" | "initiated" | "partial" | "covered";
  probe_count: number;
  last_signal?: string;
  updated_at?: string;
}

export interface CoverageMap {
  skills: CoverageSkill[];
  discovered: CoverageSkill[];
  updated_at?: string;
}

export interface TranscriptTurn {
  id: number;
  turn_number: number;
  speaker: "candidate" | "ai" | "assessor" | "system";
  text: string;
  audio_start_ms?: number;
  audio_end_ms?: number;
  created_at: string;
}

export interface SessionSummary {
  candidate_name?: string | null;
  status: "pending" | "active" | "ended" | "failed" | string;
  end_reason?:
    | "manual_candidate"
    | "manual_assessor"
    | "all_covered"
    | "time_ceiling"
    | "error"
    | string
    | null;
  started_at?: string | null;
  ended_at?: string | null;
  duration_seconds?: number | null;
  configured_skills_count: number;
  assessed_skills_count: number;
  covered_skills_count: number;
  unassessed_skills_count: number;
}

export type UnassessedSkillReason = "not_probed" | "insufficient_evidence";

export interface UnassessedSkill {
  skill_id?: string | null;
  skill_label: string;
  expected_level?: number | null;
  state: "not_yet" | "initiated" | "partial" | "covered";
  probe_count: number;
  reason: UnassessedSkillReason;
}

export interface Portfolio {
  id: number;
  session_id: number;
  candidate_id?: number;
  generation_status: "pending" | "generating" | "complete" | "failed";
  generated_at?: string;
  generation_error?: string | null;
  error_code?: string | null;
  session_summary?: SessionSummary;
  skills: PortfolioSkill[];
  unassessed_skills?: UnassessedSkill[];
  overrides: AssessorOverride[];
}

export interface PortfolioApiResponse {
  status?: "generating" | "failed" | "complete";
  portfolio?: Portfolio;
  session_summary?: SessionSummary;
  error?: string;
  error_code?: string;
}

export interface PortfolioSkill {
  id: number;
  skill_id?: string | number | null;
  skill_label: string;
  is_discovered: boolean;
  ai_level: number | string;
  ai_confidence: "high" | "medium" | "low" | string;
  coverage_state?: "not_yet" | "initiated" | "partial" | "covered" | null;
  probe_count?: number | null;
  evidence: string[];
  competency_summary: string;
}

export interface AssessorOverride {
  id: number;
  portfolio_skill_id: number;
  ai_level: number;
  override_level: number;
  assessor_notes: string;
  overridden_by?: number;
  overridden_at?: string;
}

export interface Vacancy {
  id: number;
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  skills: VacancySkill[];
}

export interface VacancySkill {
  id?: number;
  skill_id?: string | number;
  skill_label: string;
  expected_level: number;
  _destroy?: boolean;
}

export type SkillComparisonResult = "match" | "gap" | "exceed" | "not_assessed";

export type SkillAssessmentStatus =
  | "covered"
  | "partial"
  | "insufficient_evidence"
  | "not_probed";

export interface SkillComparison {
  skill_label: string;
  skill_id?: string | null;
  required_level?: number | null;
  expected_level?: number | null;
  candidate_level?: number | null;
  ai_level?: number | null;
  is_override?: boolean;
  assessor_notes?: string | null;
  assessment_status?: SkillAssessmentStatus;
  result: SkillComparisonResult;
  delta?: number | null;
  confidence?: "high" | "medium" | "low" | string | null;
}

export interface FitGapReport {
  id: number;
  portfolio_id: number;
  vacancy_id: number;
  skill_comparisons: SkillComparison[];
  culture_narrative?: string | null;
  overall_narrative?: string | null;
  generated_at: string;
}

export type FitGapStatus = "not_generated" | "generating" | "ready" | "failed";

export interface FitGapStatusResponse {
  status?: FitGapStatus;
  stale?: boolean;
  error_code?: string;
  message?: string;
  report?: FitGapReport | null;
}

export interface SkillTaxonomy {
  skill_id: string;
  skill_label: string;
  category: string;
  scope_include: string;
  scope_exclude: string;
  l1_anchor: string;
  l2_anchor: string;
  l3_anchor: string;
  l4_anchor: string;
  l5_anchor: string;
}

export interface CandidateInfo {
  session_id: number;
  role_title: string;
  time_limit_min: number;
  session_status: string;
}

export interface PaginationMeta {
  current_page: number;
  total_pages: number;
  total_count: number;
  per_page: number;
}

// WebSocket message types
export type InterviewState =
  | "idle"
  | "hardware_check"
  | "connecting"
  | "active"
  | "reconnecting"
  | "draining_audio"
  | "ending"
  | "complete";

export type InterviewSpeaker = "ai" | "candidate" | null;

export interface WsControlMessage {
  type:
    | "session_started"
    | "session_ended"
    | "transcript"
    | "transcription"
    | "reconnecting"
    | "reconnected"
    | "speaker_changed"
    | "preparing_to_end"
    | "error";
  speaker?: "candidate" | "ai";
  role?: "candidate" | "ai";
  text?: string;
  reason?: string;
  code?: string;
  message?: string;
  recoverable?: boolean;
}
