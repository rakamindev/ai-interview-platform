import api from "@/shared/services/api";
import type { Assessment, AssessmentSkill } from "@/features/assessments/types";
import type { PaginationMeta, Session } from "@/shared/types";

export interface AssessmentPayload {
  name: string;
  time_limit_min: number;
  language?: "en" | "id";
  assessment_skills_attributes: Partial<AssessmentSkill>[];
}

export interface AssessmentStats {
  total_candidates: number;
  live_now: number;
}

export const assessmentsApi = {
  list: (page = 1, q?: string) =>
    api.get<{ assessments: Assessment[]; meta: PaginationMeta; stats: AssessmentStats }>("/assessments", {
      params: { page, q },
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

  getSessions: (assessmentId: number, page = 1) =>
    api.get<{ sessions: Session[]; meta: PaginationMeta }>(`/assessments/${assessmentId}/sessions`, {
      params: { page },
    }),

  createSession: (assessmentId: number, candidateName?: string, candidateId?: number, inviteExpiryDays?: number) =>
    api.post<{ session: Session; invite_url: string }>(
      `/assessments/${assessmentId}/sessions`,
      { session: { candidate_name: candidateName, candidate_id: candidateId, invite_expiry_days: inviteExpiryDays } }
    ),

  updateSession: (sessionId: number, candidateName: string) =>
    api.patch<{ session: Session }>(`/sessions/${sessionId}`, { session: { candidate_name: candidateName } }),

  extendInvite: (sessionId: number, days = 7) =>
    api.post<{ session: Session }>(`/sessions/${sessionId}/extend_invite`, { days }),

  deleteSession: (sessionId: number) => api.delete(`/sessions/${sessionId}`),
};
