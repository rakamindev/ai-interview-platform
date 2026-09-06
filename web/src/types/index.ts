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
  /**
   * Taxonomy identifier such as "SK-ENG-001". `portfolio_skills.skill_id` is a
   * varchar and is null for custom and discovered skills. This was previously
   * declared `number`.
   */
  skill_id: string | null;
  skill_label: string;
  is_discovered: boolean;
  /**
   * Integer 1-5 exactly as stored and serialised (`portfolio_skills.ai_level`
   * is an integer with a 1..5 check constraint). This was previously declared
   * `string` with a comment claiming values of "L1".."L5", which the API has
   * never sent — so a level rendered without a lookup appeared as a bare "2"
   * where "L2" belonged.
   */
  ai_level: number;
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

/**
 * Mirrors the PostgreSQL `confidence_level` enum. Previously expressed as a bare
 * `string` with the allowed values written in a comment, which the compiler
 * could not enforce — and a rendering path did in fact treat `medium` as a
 * synonym for verified.
 */
export type ConfidenceLevel = "high" | "medium" | "low";

export type SkillComparisonResult = "match" | "gap" | "exceed" | "not_assessed";

/**
 * Mirrors the payload emitted by FitGap::Engine (api/app/services/fit_gap/engine.rb).
 *
 * `expected_level` is the field name the API and the database both use
 * (`vacancy_skills.expected_level`); an earlier version of this interface
 * declared `required_level`, which the API has never sent. Because responses are
 * cast rather than validated at the axios boundary, the compiler reported no
 * error and the "Required" column rendered blank in production. The display
 * label stays "Required"; the field name follows the domain.
 *
 * `null` is used rather than `undefined` for the not-assessed case because that
 * is what JSON carries — an unassessed requirement is an explicit absence, not a
 * missing key.
 */
export interface SkillComparison {
  skill_label: string;
  skill_id: string | null;
  expected_level: number;
  candidate_level: number | null;
  result: SkillComparisonResult;
  delta: number | null;
  /** How far the model trusted its own rating. Null when never assessed. */
  confidence: ConfidenceLevel | null;
  /** The model's level before any assessor correction. Null when never assessed. */
  ai_level: number | null;
  /** True when an assessor overrode the model's level for this skill. */
  is_override: boolean;
  /** Number of verbatim quotes supporting the rating. Zero when never assessed. */
  evidence_count: number;
}

export interface FitGapReport {
  id: number;
  portfolio_id: number;
  vacancy_id: number;
  skill_comparisons: SkillComparison[];
  culture_narrative: string | null;
  overall_narrative: string | null;
  /** True when the narrative model call failed and a rule-based summary stands in. */
  narrative_degraded: boolean;
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
