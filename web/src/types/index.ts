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

export type GenerationStatus = "queued" | "running" | "retrying" | "succeeded" | "failed" | "superseded";

/** One scoring attempt. Technical detail: shown only in the collapsed "Technical details". */
export interface PortfolioGeneration {
  id: number;
  sequence: number;
  status: GenerationStatus;
  source: string;
  requested_model?: string | null;
  served_model?: string | null;
  prompt_version?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  queued_at?: string;
  finished_at?: string | null;
}

export interface RegenerateEligibility {
  allowed: boolean;
  reason?: "report_exists" | "in_progress" | "needs_admin";
  message?: string;
}

export interface Portfolio {
  id: number;
  session_id: number;
  candidate_id?: number;
  generation_status: "pending" | "generating" | "complete" | "failed";
  generated_at?: string;
  generation_error?: string;
  current_generation?: PortfolioGeneration | null;
  latest_generation?: PortfolioGeneration | null;
  regenerate?: RegenerateEligibility;
  skills: PortfolioSkill[];
  overrides: AssessorOverride[];
}

export type EvidenceStatus = "transcript_match" | "no_exact_match" | "not_found";

/** Textual provenance only: says whether the words appear in the transcript, not whether they justify a level. */
export interface EvidenceCheck {
  quote: string;
  status: EvidenceStatus;
  turn_numbers?: number[];
  suggested_turn?: number;
}

export interface PortfolioSkill {
  id: number;
  skill_id?: string | null;
  skill_label: string;
  is_discovered: boolean;
  ai_level: number | null; // 1..5, or null = Not rated
  ai_level_reason?: "missing_level" | "invalid_level" | "ai_omitted" | null;
  ai_confidence: "high" | "medium" | "low";
  evidence: string[];
  evidence_checks?: EvidenceCheck[];
  competency_summary: string;
}

export interface AssessorOverride {
  id: number;
  portfolio_skill_id: number;
  ai_level: number | null; // the AI level the assessor saw when deciding
  override_level: number;
  assessor_notes: string;
  overridden_by?: number;
  overridden_at?: string;
  needs_review?: boolean;
  review_reason?: "ai_level_changed" | "skill_missing_in_current" | "conflicting_decisions" | "superseded_by_newer_decision" | null;
  first_made_on_generation_id?: number | null;
  last_decided_on_generation_id?: number | null;
  skill_label?: string;
  orphaned?: boolean;
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
  /** The vacancy's required level (the API field is expected_level). */
  expected_level: number;
  candidate_level?: number;
  result: SkillComparisonResult;
  delta?: number;
  is_override?: boolean;
}

export interface FitGapReport {
  id: number;
  portfolio_id: number;
  vacancy_id: number;
  skill_comparisons: SkillComparison[];
  culture_narrative: string | null;
  overall_narrative: string | null;
  /** "unavailable" when the AI wrote no narrative; the skill table is complete either way. */
  narrative_status: "generated" | "unavailable";
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
