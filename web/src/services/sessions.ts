import api from "./api";
import type { Session, CoverageMap, TranscriptTurn, Portfolio, CandidateInfo } from "@/types";

export interface LiveSessionSummary {
  id: number;
  assessment_id: number;
  candidate_name?: string;
  started_at?: string;
}

export const sessionsApi = {
  get: (id: number) =>
    api.get<{
      session: Session;
      assessment: {
        id: number;
        name: string;
        role_title: string;
        time_limit_min: number;
      };
    }>(`/sessions/${id}`),

  live: () => api.get<{ sessions: LiveSessionSummary[] }>("/sessions/live"),

  endSession: (id: number, reason = "manual_assessor") =>
    api.post<{ session: Session }>(`/sessions/${id}/end_session`, {
      session: { reason },
    }),

  revoke: (id: number) => api.post<{ session: Session }>(`/sessions/${id}/revoke`),

  getCoverage: (id: number) => api.get<CoverageMap>(`/sessions/${id}/coverage`),

  getTranscript: (id: number, fromTurn?: number) =>
    api.get<{ turns: TranscriptTurn[]; total: number }>(`/sessions/${id}/transcript`, {
      params: fromTurn ? { from_turn: fromTurn } : undefined,
    }),

  getPortfolio: (id: number) =>
    api.get<{ portfolio: Portfolio } | { status: string }>(`/sessions/${id}/portfolio`),

  regeneratePortfolio: (id: number) =>
    api.post<{ message: string; portfolio: Portfolio }>(`/sessions/${id}/portfolio/regenerate`),

  getCandidateInfo: (token: string) => api.get<CandidateInfo>(`/sessions/${token}/candidate`),

  audioComplete: (token: string) =>
    api.post<{ ended: boolean; message: string }>(`/sessions/${token}/audio_complete`),
};
