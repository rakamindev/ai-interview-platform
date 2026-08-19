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
  // Present only for sessions CvScreenings::Inviter created from a screening entry.
  cv_screening_entry_id?: number | null;
  cv_screening_score?: number | null;
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
  skill_id?: number;
  skill_label: string;
  is_discovered: boolean;
  ai_level: string;       // "L1" | "L2" | "L3" | "L4" | "L5"
  ai_confidence: string;  // "high" | "medium" | "low"
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
  public_requirement_text?: string | null;
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
  required_level: number;
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

// CV Screening

export interface CvScreeningSummary {
  total: number;
  pending: number;
  needs_review: number;
  invited: number;
  not_advanced: number;
}

export interface CvScreening {
  id: number;
  name: string;
  vacancy_id: number;
  assessment_id: number;
  threshold?: number | null;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  summary?: CvScreeningSummary;
}

export type CvScreeningNotificationStatus = "pending" | "held" | "released";

export interface CvScreeningBatch {
  id: number;
  cv_screening_id: number;
  vacancy_id: number;
  assessment_id: number;
  vacancy_version_id?: number | null;
  vacancy_version_approximate: boolean;
  threshold?: number | null;
  notification_status: CvScreeningNotificationStatus;
  created_by?: number;
  created_at?: string;
}

export type CvScreeningDecision = "pending" | "needs_review" | "invited" | "not_advanced";

export interface CvScreeningEntry {
  id: number;
  cv_screening_batch_id: number;
  detected_email?: string | null;
  decision: CvScreeningDecision;
  decision_reason?: string | null;
  score?: number | null;
  filename?: string | null;
  created_at?: string;
}

// Response shape for GET /vacancies/:id/deletion_check and
// /assessments/:id/deletion_check — checked eagerly when a recruiter clicks
// Delete, so the confirm dialog can show the right variant immediately
// instead of only discovering a block after they've typed a confirmation.
export interface DeletionCheckResult {
  deletable: boolean;
  reason?: "cv_screenings" | "sessions";
  blocking_cv_screenings?: { id: number; name: string }[];
}

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
