import api from "./api";

export interface DashboardStats {
  total_assessments: number;
  total_candidates: number;
  total_vacancies: number;
  active_count: number;
  completed_count: number;
  pending_count: number;
  shortlisted_count?: number;
  hired_count?: number;
}

export interface LiveInterview {
  id: number;
  assessment_id: number;
  assessment_name?: string;
  candidate_name?: string;
  started_at?: string;
  duration_seconds?: number;
}

export interface RecentAssessment {
  id: number;
  name: string;
  time_limit_min: number;
  language?: string;
  created_at: string;
  candidate_count?: number;
  overall_status?: "no_candidates" | "active" | "uncomplete" | "completed";
  candidates_summary?: {
    total: number;
    active: number;
    pending: number;
    completed: number;
  };
}

export interface RecentSession {
  id: number;
  assessment_id: number;
  assessment_name?: string;
  candidate_name?: string;
  status: "pending" | "active" | "ended";
  end_reason?: string;
  started_at?: string;
  created_at: string;
  duration_seconds?: number;
}

export interface DashboardData {
  stats: DashboardStats;
  live_interviews: LiveInterview[];
  recent_assessments: RecentAssessment[];
  recent_sessions: RecentSession[];
}

export const dashboardsApi = {
  get: () => api.get<DashboardData>("/dashboard"),
};

