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

  uploadCv: (token: string, file: File) => {
    const formData = new FormData();
    formData.append("cv", file);
    // No explicit Content-Type: the browser must set multipart/form-data *with*
    // its boundary, otherwise the API cannot parse the part and sees no file.
    return api.post<{
      success: boolean;
      filename: string;
      text_length: number;
      text_extracted: boolean;
      preview: string;
    }>(`/sessions/${token}/cv`, formData);
  },

  audioComplete: (token: string, reason?: "manual_candidate") =>
    api.post<{ ended: boolean; message: string }>(`/sessions/${token}/audio_complete`, null, {
      params: reason ? { reason } : undefined,
    }),
};
