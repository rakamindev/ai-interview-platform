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
  per_page?: number;
  search?: string;
}

export const assessmentsApi = {
  list: (params?: AssessmentListParams | number) => {
    const query = typeof params === "number" ? { page: params } : params;
    return api.get<{ assessments: Assessment[]; meta: PaginationMeta }>("/assessments", {
      params: query,
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

  duplicate: (id: number) =>
    api.post<{ assessment: Assessment }>(`/assessments/${id}/duplicate`),

  getSessions: (assessmentId: number) =>
    api.get<{ sessions: Session[] }>(`/assessments/${assessmentId}/sessions`),

  createSession: (assessmentId: number, candidateName?: string, candidateId?: number) =>
    api.post<{ session: Session; invite_url: string }>(
      `/assessments/${assessmentId}/sessions`,
      { session: { candidate_name: candidateName, candidate_id: candidateId } }
    ),
};
