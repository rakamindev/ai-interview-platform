import api from "./api";
import type { Assessment, AssessmentSkill, PaginationMeta, Session } from "@/types";

export interface AssessmentPayload {
  name: string;
  time_limit_min: number;
  language?: "en" | "id";
  assessment_skills_attributes: Partial<AssessmentSkill>[];
}

export interface AssessmentListParams {
  page?: number;
  search?: string;
  status?: string;
  sort_by?: "created_at" | "updated_at";
}

export interface AssessmentSummaryData {
  assessment: {
    id: number;
    name: string;
    time_limit_min: number;
    language?: string;
  };
  sessions: Array<{
    id: number;
    candidate_name?: string;
    status: "pending" | "active" | "ended";
    end_reason?: string;
    started_at?: string;
    ended_at?: string;
    duration_seconds?: number;
    created_at?: string;
    portfolio_status?: string;
    portfolio_id?: number;
  }>;
  stats: {
    total: number;
    pending: number;
    active: number;
    ended: number;
    completed: number;
    failed: number;
    avg_duration_min?: number;
  };
}

export const assessmentsApi = {
  list: (params?: AssessmentListParams | number, search?: string) => {
    const options: AssessmentListParams =
      typeof params === "number"
        ? { page: params, search }
        : params || {};

    return api.get<{ assessments: Assessment[]; meta: PaginationMeta }>("/assessments", {
      params: {
        page: options.page ?? 1,
        search: options.search?.trim() || undefined,
        status: options.status || undefined,
        sort_by: options.sort_by || undefined,
      },
    });
  },

  get: (id: number) =>
    api.get<{ assessment: Assessment }>(`/assessments/${id}`),

  create: (data: AssessmentPayload) =>
    api.post<{ assessment: Assessment; system_prompt_generated: boolean }>(
      "/assessments",
      { assessment: data }
    ),

  update: (id: number, data: AssessmentPayload) =>
    api.put<{ assessment: Assessment; system_prompt_generated: boolean }>(
      `/assessments/${id}`,
      { assessment: data }
    ),

  delete: (id: number) => api.delete(`/assessments/${id}`),

  getSessions: (
    assessmentId: number,
    params?: { page?: number; search?: string; status?: string; all?: boolean }
  ) =>
    api.get<{ sessions: Session[]; meta?: PaginationMeta }>(
      `/assessments/${assessmentId}/sessions`,
      { params }
    ),

  createSession: (assessmentId: number, candidateName?: string, candidateId?: number) =>
    api.post<{ session: Session; invite_url: string }>(
      `/assessments/${assessmentId}/sessions`,
      { session: { candidate_name: candidateName, candidate_id: candidateId } }
    ),

  updateSession: (sessionId: number, data: { candidate_name: string }) =>
    api.patch<{ session: Session }>(`/sessions/${sessionId}`, { session: data }),

  deleteSession: (sessionId: number) =>
    api.delete(`/sessions/${sessionId}`),

  getSummary: (assessmentId: number) =>
    api.get<AssessmentSummaryData>(`/assessments/${assessmentId}/summary`),
};
