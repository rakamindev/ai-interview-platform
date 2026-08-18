import api from "./api";
import type { Assessment, AssessmentSkill, PaginationMeta, Session } from "@/types";

export interface AssessmentPayload {
  name: string;
  time_limit_min: number;
  language?: "en" | "id";
  assessment_skills_attributes: Partial<AssessmentSkill>[];
}

export const assessmentsApi = {
  list: (page = 1) =>
    api.get<{ assessments: Assessment[]; meta: PaginationMeta }>("/assessments", {
      params: { page },
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

  getSessions: (assessmentId: number) =>
    api.get<{ sessions: Session[] }>(`/assessments/${assessmentId}/sessions`),

  createSession: (
    assessmentId: number,
    candidateName: string,
    candidateEmail: string,
    candidateId?: number
  ) =>
    api.post<{ session: Session; invite_url: string }>(
      `/assessments/${assessmentId}/sessions`,
      {
        session: {
          candidate_name: candidateName,
          candidate_email: candidateEmail,
          candidate_id: candidateId,
        },
      }
    ),
};

