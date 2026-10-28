import api from "./api";
import type { Session, CoverageMap, TranscriptTurn, Portfolio, CandidateInfo } from "@/types";

export const sessionsApi = {
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

  audioComplete: (token: string) =>
    api.post<{ ended: boolean; message: string }>(`/sessions/${token}/audio_complete`),
};
