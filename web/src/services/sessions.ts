import api from "./api";
import type {
  Session,
  CoverageMap,
  TranscriptTurn,
  Portfolio,
  CandidateInfo,
  ConsentPolicy,
  ConsentRecord,
  CandidateRow,
} from "@/types";

export const sessionsApi = {
  /** Every candidate in the tenant, across all assessments. */
  listCandidates: (status?: string) =>
    api.get<{ sessions: CandidateRow[] }>("/sessions/candidates", {
      params: status && status !== "all" ? { status } : undefined,
    }),

  get: (id: number) =>
    api.get<{ session: Session; assessment: { id: number; name: string; time_limit_min: number } }>(
      `/sessions/${id}`
    ),

  /** Sign off (or undo) that a human has read this candidate's results. */
  setReviewed: (id: number, reviewed: boolean) =>
    api.patch<{ session: Session }>(`/sessions/${id}/review`, { reviewed }),

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

  getConsent: (token: string) =>
    api.get<ConsentPolicy>(`/sessions/${token}/consent`),

  submitConsent: (token: string, status: "accepted" | "declined") =>
    api.post<{ consent: ConsentRecord }>(`/sessions/${token}/consent`, { consent: { status } }),

  audioComplete: (token: string) =>
    api.post<{ ended: boolean; message: string }>(`/sessions/${token}/audio_complete`),
};
