// Re-export inferred types from zod schemas.
// The schemas ARE the source of truth; these types cannot drift.
export type { Portfolio, PortfolioSkill, AssessorOverride } from "@/schemas/portfolio";

export type {
  Session,
  CoverageSkill,
  CoverageMap,
  TranscriptTurn,
  CandidateInfo
} from "@/schemas/session";

export type { Vacancy, VacancySkill } from "@/schemas/vacancy";

export type { SkillComparisonResult, SkillComparison } from "@/schemas/comparison";

export type { FitGapReport } from "@/schemas/fitgap";

// Types not covered by schemas (internal / websocket / UI-only)
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
    | "transcript_partial"
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
