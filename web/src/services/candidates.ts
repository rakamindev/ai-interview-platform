import api from "./api";

export interface CandidateRecord {
  id: number; // session ID: each row is one interview session
  assessment_id: number;
  assessment_name: string;
  candidate_id: number | null;
  candidate_name: string | null;
  candidate_email: string | null;
  status: "pending" | "active" | "ended" | "failed" | string;
  end_reason: string | null;
  hiring_decision: "under_review" | "accepted" | "rejected" | null;
  started_at: string | null;
  ended_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface CandidateStatistics {
  total: number;
  pending: number;
  active: number;
  completed: number;
  failed: number;
  expired: number;
  under_review: number;
  accepted: number;
  rejected: number;
}

export interface CandidatesResponse {
  candidates: CandidateRecord[];
  assessments: Array<{ id: number; name: string }>;
  meta: {
    current_page: number;
    total_pages: number;
    total_count: number;
    per_page: number;
    statistics: CandidateStatistics;
  };
}

export interface CandidateFilters {
  page?: number;
  q?: string;
  assessment_id?: number;
  interview_status?: "all" | "pending" | "active" | "completed" | "failed" | "expired";
  hiring_decision?: "all" | "under_review" | "accepted" | "rejected";
}

export const candidatesApi = {
  list: (filters: CandidateFilters = {}) =>
    api.get<CandidatesResponse>("/candidates", { params: filters }),
};
