import api from "./api";
import type { Assessment, AssessmentSkill, PaginationMeta, Session } from "@/types";

export interface AssessmentPayload {
  name: string;
  role_title?: string;
  time_limit_min: number;
  language?: "en" | "id";
  assessment_skills_attributes: Partial<AssessmentSkill>[];
}

export interface CreatedAssessment {
  assessment: Assessment;
  system_prompt_generated: boolean;
  session?: Partial<Session>;
  invite_url?: string;
}

export const assessmentsApi = {
  list: (page = 1) =>
    api.get<{ assessments: Assessment[]; meta: PaginationMeta }>("/assessments", {
      params: { page },
    }),

  get: (id: number) => api.get<{ assessment: Assessment }>(`/assessments/${id}`),

  create: (data: AssessmentPayload, createSession = false) =>
    api.post<CreatedAssessment>("/assessments", {
      assessment: data,
      create_session: createSession,
    }),

  update: (id: number, data: AssessmentPayload) =>
    api.put<{ assessment: Assessment; system_prompt_generated: boolean }>(`/assessments/${id}`, {
      assessment: data,
    }),

  delete: (id: number) => api.delete(`/assessments/${id}`),

  getSystemPrompt: (id: number) =>
    api.get<{ system_prompt: string }>(`/assessments/${id}/system_prompt`),

  getSessions: (assessmentId: number) =>
    api.get<{ sessions: Session[] }>(`/assessments/${assessmentId}/sessions`),

  createSession: (assessmentId: number, candidateName?: string, candidateId?: number) =>
    api.post<{ session: Session; invite_url: string }>(`/assessments/${assessmentId}/sessions`, {
      session: { candidate_name: candidateName, candidate_id: candidateId },
    }),
};
