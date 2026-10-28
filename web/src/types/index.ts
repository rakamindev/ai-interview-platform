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
  generation_status: "pending" | "generating" | "complete" | "failed";
  generated_at?: string | null;
  generation_error?: string | null;
  generation_started_at?: string | null;
  generation_attempts?: number;
  skills: PortfolioSkill[];
  overrides: AssessorOverride[];
}

export type Confidence = "high" | "medium" | "low";
export type AssessmentStatus = "assessed" | "not_assessed";
/** Why a skill has no AI level. `not_in_interview` only appears in fit/gap rows. */
export type NotAssessedReason = "never_reached" | "model_omitted" | "invalid_level" | "not_in_interview";

export interface EvidenceRef {
  quote: string;
  turn_number: number;
}

export interface PortfolioSkill {
  id: number;
  skill_id?: string | null;
  skill_label: string;
  is_discovered: boolean;
  /** Older API versions omit this; treat a missing value as "assessed". */
  assessment_status?: AssessmentStatus;
  status_reason?: NotAssessedReason | null;
  /** 1–5, or null when the skill was not assessed. Older payloads may send "L3". */
  ai_level: number | string | null;
  ai_confidence: Confidence | null;
  coverage_state?: CoverageSkill["state"] | null;
  probe_count?: number | null;
  /** Quotes verified against the transcript. */
  evidence: string[];
  evidence_refs?: EvidenceRef[];
  /** Quotes the AI cited that could not be found in the transcript and were dropped. */
  unverified_evidence_count?: number;
  competency_summary: string;
}

export interface AssessorOverride {
  id: number;
  portfolio_skill_id: number;
  ai_level: number | null;
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
  skill_label: string;
  skill_id?: string | null;
  /** Reports generated before this field existed only carry expected_level. */
  required_level?: number;
  expected_level?: number;
  candidate_level?: number | null;
  result: SkillComparisonResult;
  delta?: number | null;
  is_override?: boolean;
  confidence?: Confidence | null;
  needs_review?: boolean;
  not_assessed_reason?: NotAssessedReason | null;
}

export interface FitGapReport {
  id: number;
  portfolio_id: number;
  vacancy_id: number;
  skill_comparisons: SkillComparison[];
  culture_narrative: string | null;
  overall_narrative: string | null;
  generated_at: string;
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
