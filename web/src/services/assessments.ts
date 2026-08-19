import api from "./api";
import type { Assessment, AssessmentSkill, PaginationMeta, Session } from "@/types";

export interface CreateSessionPayload {
  candidate_name: string;
  candidate_email: string;
  candidate_phone?: string;
  expires_at?: string;
}

export interface AssessmentPayload {
  name: string;
  time_limit_min: number;
  language?: "en" | "id";
  assessment_skills_attributes: Partial<AssessmentSkill>[];
}

export const assessmentsApi = {
  list: (page = 1, archived = false, q?: string) =>
    api.get<{ assessments: Assessment[]; meta: PaginationMeta }>("/assessments", {
      params: { page, ...(archived ? { archived: "true" } : {}), ...(q ? { q } : {}) },
    }),

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

  archive: (id: number) => api.post(`/assessments/${id}/archive`),

  unarchive: (id: number) => api.post(`/assessments/${id}/unarchive`),

  getSessions: (assessmentId: number, page = 1, q?: string) =>
    api.get<{ sessions: Session[]; meta: PaginationMeta }>(`/assessments/${assessmentId}/sessions`, {
      params: { page, ...(q ? { q } : {}) },
    }),

  createSession: (assessmentId: number, payload: CreateSessionPayload) =>
    api.post<{ session: Session; invite_url: string }>(
      `/assessments/${assessmentId}/sessions`,
      { session: payload }
    ),
};
