import { apiClient } from "@/lib/api-client";
import type { CandidateInfo } from "@/features/session/schemas/interview";

export const candidateApi = {
  getInfo: (token: string) =>
    apiClient.get<CandidateInfo>(`/sessions/${token}/candidate`),

  audioComplete: (token: string) =>
    apiClient.post<{ ended: boolean; message: string }>(`/sessions/${token}/audio_complete`),
};
