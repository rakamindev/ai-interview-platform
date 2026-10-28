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

  /**
   * candidateEmail ties the session to a candidate account: that is what makes
   * the interview show up on the candidate's own dashboard.
   */
  createSession: (
    assessmentId: number,
    attrs: { candidateName?: string; candidateEmail?: string; candidateId?: number } = {}
  ) =>
    api.post<{ session: Session; invite_url: string }>(
      `/assessments/${assessmentId}/sessions`,
      {
        session: {
          candidate_name: attrs.candidateName,
          candidate_email: attrs.candidateEmail,
          candidate_id: attrs.candidateId,
        },
      }
    ),
};
