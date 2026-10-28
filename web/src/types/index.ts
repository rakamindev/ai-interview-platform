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
  // Matches SkillTaxonomy.skill_id (e.g. "SK-ENG-001") — a taxonomy-sourced
  // skill carries it through from the picker; a custom skill has none.
  // Previously typed `number`, which every backend skill_id column
  // (varchar) never actually is — see SkillPicker.tsx's onSelect, which
  // worked around the mismatch by discarding the real value entirely.
  skill_id?: string;
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
  skill_id: string;
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

// A skill the interview never reached, or reached too briefly to trust, is
// not the same thing as a bad result — see Portfolios::SkillStatus (backend)
// for the rule that derives this from coverage data rather than trusting
// whatever level the AI reports for itself.
export type SkillAssessmentStatus = "assessed" | "insufficient_evidence" | "not_assessed";

export interface PortfolioSkill {
  id: number;
  skill_id?: string;
  skill_label: string;
  is_discovered: boolean;
  assessment_status: SkillAssessmentStatus;
  // null exactly when assessment_status is "not_assessed". Previously typed
  // as a string ("L1".."L5") — the backend has only ever sent a plain
  // integer here (see Api::V1::PortfoliosController#portfolio_skill_json);
  // every `parseLevel(skill.ai_level)` call site elsewhere in this codebase
  // was converting a type that was never actually a string at runtime.
  ai_level: number | null;
  ai_confidence: string;  // "high" | "medium" | "low"
  evidence: string[];
  evidence_count: number;
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
  skill_id?: string;
  skill_label: string;
  expected_level: number;
  _destroy?: boolean;
}

export type SkillComparisonResult = SkillAssessmentStatus | "match" | "gap" | "exceed";

export interface SkillComparison {
  skill_label: string;
  skill_id?: string;
  expected_level: number;
  // Set only when result is match/gap/exceed (i.e. the skill was actually
  // assessed, or a human override stands in for that).
  candidate_level: number | null;
  // Set only when result is insufficient_evidence — the level the AI
  // reported, kept for context but never scored against expected_level.
  provisional_level: number | null;
  ai_level: number | null;
  result: SkillComparisonResult;
  delta: number | null;
  confidence: string | null;
  evidence_count: number;
  is_override: boolean;
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
  | "complete"
  | "link_error";

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
