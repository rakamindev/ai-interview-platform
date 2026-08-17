import api, { type CandidateRequestConfig } from "./api";
import type {
  Session,
  CoverageMap,
  TranscriptTurn,
  Portfolio,
  CandidateInfo,
  ConsentRecord,
} from "@/types";

export const sessionsApi = {
  get: (id: number) =>
    api.get<{
      session: Session;
      assessment: { id: number; name: string; time_limit_min: number };
    }>(`/sessions/${id}`),

  endSession: (id: number, reason = "manual_assessor") =>
    api.post<{ session: Session }>(`/sessions/${id}/end_session`, {
      session: { reason },
    }),

  getCoverage: (id: number) => api.get<CoverageMap>(`/sessions/${id}/coverage`),

  getTranscript: (id: number, fromTurn?: number) =>
    api.get<{ turns: TranscriptTurn[]; total: number }>(
      `/sessions/${id}/transcript`,
      {
        params: fromTurn ? { from_turn: fromTurn } : undefined,
      }
    ),

  getPortfolio: (id: number) =>
    api.get<{ portfolio: Portfolio } | { status: string }>(
      `/sessions/${id}/portfolio`
    ),

  regeneratePortfolio: (id: number) =>
    api.post<{ message: string; portfolio: Portfolio }>(
      `/sessions/${id}/portfolio/regenerate`
    ),

  getCandidateInfo: (token: string) =>
    api.get<CandidateInfo>(`/sessions/${token}/candidate`, {
      skipAuthRedirect: true,
    } as CandidateRequestConfig),

  grantConsent: (token: string, version: string) =>
    api.post<{ consent: ConsentRecord; status: string }>(
      `/sessions/${token}/consent`,
      { version },
      { skipAuthRedirect: true } as CandidateRequestConfig
    ),

  revokeConsent: (token: string) =>
    api.post<{ consent: ConsentRecord; status: string }>(
      `/sessions/${token}/consent/revoke`,
      {},
      { skipAuthRedirect: true } as CandidateRequestConfig
    ),

  getCandidateTranscript: (token: string) =>
    api.get<{ turns: TranscriptTurn[]; total: number }>(
      `/sessions/${token}/candidate/transcript`,
      { skipAuthRedirect: true } as CandidateRequestConfig
    ),

  deleteCandidateData: (token: string) =>
    api.delete<{ status: string; message: string }>(`/sessions/${token}/data`, {
      skipAuthRedirect: true,
    } as CandidateRequestConfig),

  audioComplete: (token: string) =>
    api.post<{ ended: boolean; message: string }>(
      `/sessions/${token}/audio_complete`
    ),
};
