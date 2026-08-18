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

export type ConfidenceLevel = "high" | "medium" | "low";

export interface PortfolioSkill {
  id: number;
  /** Taxonomy id such as "SK-ENG-001"; null for discovered skills. */
  skill_id?: string | null;
  skill_label: string;
  is_discovered: boolean;
  /**
   * 1-5, or null when the interview produced no assessable evidence.
   *
   * Previously typed `string` with a comment claiming "L1".."L5". The API
   * serialises the integer column directly, so consumers that trusted the
   * annotation rendered a bare "3" where they meant "L3". Nullable since
   * migration 20260819000000 — an unassessed skill has no level, and the
   * generator no longer invents one.
   */
  ai_level: number | null;
  ai_confidence: ConfidenceLevel;
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

export type SkillComparisonResult = "match" | "gap" | "exceed" | "not_assessed";

/** Why a skill has no candidate level. */
export type NotAssessedReason = "not_covered" | "insufficient_evidence";

export interface SkillComparison {
  skill_label: string;
  skill_id?: string | null;
  /**
   * The level the vacancy requires.
   *
   * This was previously declared as `required_level`, which the API has never
   * emitted — the field is `expected_level`, matching the vacancy_skills
   * column. Every row therefore rendered an empty Required cell. Renaming the
   * client to match the server (rather than the reverse) also repairs every
   * fit/gap report already persisted, since skill_comparisons is stored JSONB.
   */
  expected_level: number;
  /** null when the skill was never assessed. */
  candidate_level?: number | null;
  result: SkillComparisonResult;
  delta?: number | null;
  confidence?: ConfidenceLevel | null;
  /** True when an assessor overrode the model's level. */
  is_override?: boolean;
  /** The model's original level, retained when an override is applied. */
  ai_level?: number | null;
  not_assessed_reason?: NotAssessedReason | null;
}

/** 'fallback' means the AI narrative failed and this is a mechanical summary. */
export type NarrativeStatus = "complete" | "fallback";

export interface FitGapReport {
  id: number;
  portfolio_id: number;
  vacancy_id: number;
  skill_comparisons: SkillComparison[];
  culture_narrative: string | null;
  overall_narrative: string | null;
  narrative_status?: NarrativeStatus;
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
