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
  generated_at?: string;
  generation_error?: string;
  skills: PortfolioSkill[];
  overrides: AssessorOverride[];
}

export interface PortfolioSkill {
  id: number;
  /** varchar(50) in the database — was previously typed as a number. */
  skill_id: string | null;
  skill_label: string;
  is_discovered: boolean;
  assessment_state: AssessmentState;
  /** Integer, not "L3". Null whenever assessment_state is not "assessed". */
  ai_level: number | null;
  ai_confidence: Confidence | null;
  effective_level: number | null;
  is_override: boolean;
  superseded_at?: string | null;
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
  skill_id?: number;
  skill_label: string;
  expected_level: number;
  _destroy?: boolean;
}

export type SkillComparisonResult =
  | "match"
  | "gap"
  | "exceed"
  | "not_assessed"
  | "additional";

/** Why a portfolio skill does or does not carry a level. */
export type AssessmentState = "assessed" | "insufficient_evidence" | "not_probed";

export type Confidence = "high" | "medium" | "low";

/**
 * Mirrors FitGap::Engine#comparison_for exactly.
 *
 * The previous version of this interface declared `required_level` and
 * `is_override`, neither of which the API has ever sent — so the compiler was
 * satisfied while the Required column rendered `undefined` on every row and the
 * override marker never appeared. Types alone cannot prevent that; these shapes
 * are now validated at runtime in services/schemas.ts.
 */
export interface SkillComparison {
  skill_label: string;
  skill_id: string | null;
  /** Null for skills the candidate has but the vacancy did not ask for. */
  required_level: number | null;
  /** @deprecated Alias of required_level, retained for one release. */
  expected_level?: number | null;
  /** The rating to decide on: the assessor's if they made one, else the model's. */
  candidate_level: number | null;
  ai_level: number | null;
  override_level: number | null;
  is_override: boolean;
  confidence: Confidence | null;
  assessment_state: AssessmentState;
  result: SkillComparisonResult;
  delta: number | null;
  in_vacancy: boolean;
  is_discovered?: boolean;
}

export type NarrativeStatus = "complete" | "failed" | "skipped";

export interface FitGapReport {
  id: number;
  portfolio_id: number;
  vacancy_id: number;
  skill_comparisons: SkillComparison[];
  culture_narrative: string | null;
  overall_narrative: string | null;
  /** Distinguishes "the model failed" from "there was nothing to say". */
  narrative_status: NarrativeStatus;
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
