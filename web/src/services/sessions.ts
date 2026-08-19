import api from "./api";
import type { Session, CoverageMap, TranscriptTurn, Portfolio, CandidateInfo, PaginationMeta } from "@/types";

export interface SessionListParams {
  page?: number;
  per_page?: number;
  status?: string;
  search?: string;
  assessment_id?: number;
}

export const sessionsApi = {
  all: (params?: SessionListParams) =>
    api.get<{ sessions: Session[]; meta: PaginationMeta }>("/sessions", { params }),

  get: (id: number) =>
    api.get<{ session: Session; assessment: { id: number; name: string; time_limit_min: number } }>(
      `/sessions/${id}`
    ),

  endSession: (id: number, reason = "manual_assessor") =>
    api.post<{ session: Session }>(`/sessions/${id}/end_session`, {
      session: { reason },
    }),

  getCoverage: (id: number) =>
    api.get<CoverageMap>(`/sessions/${id}/coverage`),

  getTranscript: (id: number, fromTurn?: number) =>
    api.get<{ turns: TranscriptTurn[]; total: number }>(`/sessions/${id}/transcript`, {
      params: fromTurn ? { from_turn: fromTurn } : undefined,
    }),

  getPortfolio: (id: number) =>
    api.get<{ portfolio: Portfolio } | { status: string }>(`/sessions/${id}/portfolio`),

  regeneratePortfolio: (id: number) =>
    api.post<{ message: string; portfolio: Portfolio }>(`/sessions/${id}/portfolio/regenerate`),

  getCandidateInfo: (token: string) =>
    api.get<CandidateInfo>(`/sessions/${token}/candidate`),

  updateProgress: (
    token: string,
    data: { stage?: string; consent_accepted?: boolean; device_check_passed?: boolean }
  ) =>
    api.post<{ success: boolean; candidate_stage: string; session_status: string }>(
      `/sessions/${token}/progress`,
      data
    ),

  audioComplete: (token: string) =>
    api.post<{ ended: boolean; message: string }>(`/sessions/${token}/audio_complete`),

  bulkCreate: (assessmentId: number, candidates: Array<{ name?: string; email?: string } | string>) =>
    api.post<{ sessions: Array<{ session: Session; invite_url: string }>; count: number }>(
      `/assessments/${assessmentId}/sessions/bulk`,
      { candidates }
    ),
};
