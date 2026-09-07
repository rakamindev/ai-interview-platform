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
  session_count?: number;
  latest_session?: {
    id?: number;
    status: "pending" | "active" | "ended" | "failed";
    end_reason?: string | null;
    started_at?: string | null;
    ended_at?: string | null;
    portfolio_status?: "pending" | "generating" | "complete" | "failed" | null;
  };
}

// skill_id holds a B7 taxonomy code such as "SK-ENG-001", not a number. It was
// declared numeric here, in CoverageSkill and in VacancySkill alike, which is
// why the picker quietly dropped it rather than failing to compile.
export interface AssessmentSkill {
  id?: number;
  skill_id?: string | null;
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
  skill_id?: string | null;
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

// Mirrors what PortfoliosController actually serialises. `ai_level` was
// declared as a string annotated "L1" | "L2" | ... — the column is an integer,
// the API sends an integer, and parseLevel() exists in this codebase to paper
// over the mismatch at every call site rather than fixing it here.
// `skill_id` is a taxonomy code such as "SK-ENG-001", not a number.
export interface PortfolioSkill {
  id: number;
  skill_id?: string | null;
  skill_label: string;
  is_discovered: boolean;
  // null means the interview never reached this skill. Not a zero, not an L1.
  ai_level: number | null;
  ai_confidence: "high" | "medium" | "low" | null;
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
  skill_id?: string | null;
  skill_label: string;
  expected_level: number;
  _destroy?: boolean;
}

export type SkillComparisonResult = "match" | "gap" | "exceed" | "not_assessed";

// Mirrors the payload FitGap::Engine actually stores in
// fit_gap_reports.skill_comparisons. It previously declared `required_level`,
// which the API has never sent — so the "Required" column rendered
// LEVEL_LABELS[undefined] and sat permanently blank while TypeScript stayed
// quiet, because the type described the component rather than the API.
export interface SkillComparison {
  skill_label: string;
  skill_id?: string | null;
  expected_level: number;
  candidate_level?: number | null;
  result: SkillComparisonResult;
  delta?: number | null;
  confidence?: "high" | "medium" | "low" | null;
  is_override?: boolean;
}

export interface FitGapReport {
  id: number;
  portfolio_id: number;
  vacancy_id: number;
  skill_comparisons: SkillComparison[];
  culture_narrative: string;
  overall_narrative: string;
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
