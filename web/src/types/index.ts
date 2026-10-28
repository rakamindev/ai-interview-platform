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
  // List only: candidates, and candidates whose portfolio still needs review.
  candidate_count?: number;
  needs_review_count?: number;
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
  // Candidate list only (GET /assessments/:id/sessions).
  portfolio_status?: PortfolioStatus;
  review_summary?: ReviewReason[];
}

export type PortfolioStatus = "none" | "generating" | "ready" | "failed";

// Why a portfolio still needs a human (Portfolios::ReviewReasons on the API).
export type ReviewReasonCode =
  | "generation_failed"
  | "empty_portfolio"
  | "legacy_ratings"
  | "unreviewed_low_confidence"
  | "unreviewed_not_assessed"
  | "narrative_failed"
  | "narrative_outdated";

export interface ReviewReason {
  code: ReviewReasonCode;
  count: number;
}

export type ReviewGroup = "skills" | "narratives" | "legacy" | "portfolio";

export interface ReviewQueueItem {
  portfolio_id: number;
  session_id: number;
  assessment_id: number;
  assessment_name: string;
  candidate_name: string | null;
  reasons: ReviewReason[];
  waiting_since: string;
  target: { page: "portfolio" | "fitgap"; vacancy_id: number | null };
}

export interface ReviewQueue {
  summary: Record<ReviewReasonCode | "portfolios", number>;
  items: ReviewQueueItem[];
  meta: PaginationMeta;
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
  generation_error_code?: string | null;
  generation_error_message?: string | null;
  ratings_validated?: boolean;
  skills: PortfolioSkill[];
  overrides: AssessorOverride[];
}

export interface PortfolioSkill {
  id: number;
  skill_id?: number;
  skill_label: string;
  is_discovered: boolean;
  rating_status: "assessed" | "not_assessed";
  not_assessed_reason?: NotAssessedReason | null;
  coverage?: { state: string | null; probe_count: number | null };
  ai_level: number | null;                             // integer 1..5, null when not assessed
  ai_confidence: "high" | "medium" | "low" | null;     // computed from coverage, null when not assessed
  effective_level?: number | null;
  level_source?: LevelSource | null;
  assessor_confirmed?: boolean;
  review?: SkillReview | null;
  evidence: string[];
  competency_summary: string;
}

export type NotAssessedReason = "not_covered" | "no_level_from_model" | "invalid_level_from_model" | "no_evidence";

export interface AssessorOverride {
  id: number;
  portfolio_skill_id: number;
  ai_level: number;
  override_level: number;
  assessor_notes: string;
  overridden_by?: number;
  overridden_at?: string;
  lock_version?: number;
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

export type SkillComparisonResult = "match" | "gap" | "exceed" | "not_assessed" | "low_confidence";
export type LevelSource = "ai" | "assessor_confirmed" | "assessor_override";

// Mirrors FitGap::ReportPresenter (api/app/services/fit_gap/report_presenter.rb).
// The assessor decision behind a level (same shape as the API "review").
export interface SkillReview {
  action: "override" | "confirm";
  ai_level: number | null;
  notes: string | null;
  actor_id: number;
  at: string;
}

// One append-only assessor decision on a skill (GET /portfolio_skills/:id/override_events).
export interface OverrideEvent {
  id: number;
  action: "set" | "revert" | "confirm";
  from_level: number | null;
  to_level: number | null;
  ai_level_at_time: number | null;
  notes: string | null;
  actor_id: number;
  created_at: string;
}

export interface SkillComparison {
  skill_label: string;
  skill_id?: string | null;
  expected_level: number;
  ai_level?: number | null;
  candidate_level: number | null;
  level_source: LevelSource | null;
  is_override: boolean;
  override_notes?: string | null;
  confidence: "high" | "medium" | "low" | null;
  result: SkillComparisonResult;
  delta: number | null;
  counts_toward_fit: boolean;
  not_assessed_reason?: NotAssessedReason | null;
  tentative_direction?: "below" | "equal" | "above" | null;
  portfolio_skill_id?: number | null;
  probe_count?: number | null;
  review?: SkillReview | null;
}

export interface FitGapSummary {
  total: number;
  evidenced: number;
  match: number;
  exceed: number;
  gap: number;
  not_assessed: number;
  low_confidence: number;
  overridden: number;
  confirmed: number;
}

export interface FitGapNarrative {
  status: "not_requested" | "generating" | "complete" | "failed" | "outdated";
  source: "ai" | "legacy_fallback" | null;
  label: string;
  culture: string | null;
  overall: string | null;
  generated_at?: string | null;
  error_code?: string | null;
}

export interface FitGapReport {
  portfolio_id: number;
  vacancy_id: number;
  role_title?: string;
  ratings_validated?: boolean;
  summary: FitGapSummary;
  comparisons: SkillComparison[];
  follow_up: string[];
  narrative: FitGapNarrative;
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
