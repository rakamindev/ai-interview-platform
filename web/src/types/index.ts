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

export interface Portfolio {
  id: number;
  session_id: number;
  candidate_id?: number;
  generation_status: "pending" | "generating" | "complete" | "failed" | "partial";
  generated_at?: string;
  generation_error?: string;
  failure_reason?: "missing_assessment_skills" | "missing_coverage" | "generation_failed";
  skills: PortfolioSkill[];
  overrides: AssessorOverride[];
}

export interface PortfolioSkill {
  id: number;
  skill_id?: number;
  skill_label: string;
  is_discovered: boolean;
  ai_level: string;       // "L1" | "L2" | "L3" | "L4" | "L5"
  ai_confidence: string;  // "high" | "medium" | "low"
  evidence: PortfolioEvidence[];
  evidence_status: "verified" | "legacy" | "insufficient";
  competency_summary: string;
}

export interface PortfolioEvidence {
  turn_id: number | null;
  turn_number: number | null;
  quote: string;
  verification_status: "verified" | "legacy";
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
  skill_id?: number;
  skill_label: string;
  expected_level: number;
  _destroy?: boolean;
}

export type SkillComparisonResult = "match" | "gap" | "exceed" | "not_assessed";

export interface SkillComparison {
  skill_id?: string | null;
  skill_label: string;
  expected_level?: number;
  candidate_level?: number | null;
  ai_level?: number | null;
  rating_source?: "ai" | "assessor_override" | null;
  result?: SkillComparisonResult;
  fit_result?: SkillComparisonResult;
  delta?: number | null;
  confidence?: "high" | "medium" | "low" | null;
  note?: string | null;
}

export type FitGapFreshness = "current" | "updating" | "outdated" | "failed";

export interface FitGapReport {
  id: number;
  portfolio_id: number;
  vacancy_id: number;
  skill_comparisons: SkillComparison[];
  culture_narrative?: string | null;
  overall_narrative?: string | null;
  generated_at?: string | null;
  generation_status: "complete" | "generating" | "failed";
  generation_error?: string | null;
  freshness: FitGapFreshness;
  has_completed_report: boolean;
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
  deadline_at?: string | null;
  remaining_seconds?: number | null;
  resume_available?: boolean;
  recovery_message?: string | null;
  recent_transcript?: TranscriptTurn[];
}

export interface PaginationMeta {
  current_page: number;
  total_pages: number;
  total_count: number;
  per_page: number;
}

// ── Unified error envelope (F-26) ──────────────────────────────────────
// Backend contract: every HTTP error is { error: { code, message, details? } }.
// The legacy envelopes ({ errors: [...] } and { error: "string" }) are still
// parsed by the interceptor for backward compatibility — see lib/apiErrors.
export interface ApiErrorEnvelope {
  code: string;
  message: string;
  details?: unknown;
}

export interface NormalizedApiError {
  /** HTTP status when the server responded; undefined for network failures. */
  status?: number;
  /** Machine-readable code (e.g. "not_found", "rate_limited", "network_error"). */
  code: string;
  /** Human-readable message safe to show to the user. */
  message: string;
}

// WebSocket message types
export type InterviewState =
  | "idle"
  | "resume"
  | "connecting"
  | "active"
  | "in_use"
  | "taken_over"
  | "reconnecting"
  | "draining_audio"
  | "ending"
  | "complete"
  | "error";

export type InterviewErrorKind =
  | "load_failed"
  | "auth_failed"
  | "resume_unavailable"
  | "microphone_unavailable"
  | "ws_unrecoverable"
  | "ws_connection_lost";

export interface InterviewErrorInfo {
  kind: InterviewErrorKind;
  /** Raw error code from the backend WS message, when available. */
  code?: string;
  message?: string;
  /** Whether retrying the session is expected to help. */
  recoverable: boolean;
}

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
    | "session_in_use"
    | "session_taken_over"
    | "error";
  speaker?: "candidate" | "ai";
  role?: "candidate" | "ai";
  text?: string;
  reason?: string;
  code?: string;
  message?: string;
  recoverable?: boolean;
  session_id?: number;
  turn_id?: number;
  turn_number?: number;
  deadline_at?: string;
  remaining_seconds?: number;
}
