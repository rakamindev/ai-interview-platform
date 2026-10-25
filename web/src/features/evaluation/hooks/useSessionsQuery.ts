import { useQuery } from "@tanstack/react-query";
import { sessionsApi } from "../services/sessions";
import { queryKeys } from "@/lib/queryKeys";
import type { Session, TranscriptTurn } from "@/types";

export function useSessionQuery(sessionId: number | string | undefined) {
  const sId = Number(sessionId);

  return useQuery({
    queryKey: queryKeys.sessions.detail(sId),
    queryFn: async (): Promise<Session> => {
      const res = await sessionsApi.get(sId);
      return res.data.session;
    },
    enabled: !isNaN(sId) && sId > 0,
  });
}

export function useSessionTranscriptQuery(sessionId: number | string | undefined) {
  const sId = Number(sessionId);

  return useQuery({
    queryKey: queryKeys.sessions.transcript(sId),
    queryFn: async (): Promise<{ turns: TranscriptTurn[]; total: number }> => {
      const res = await sessionsApi.getTranscript(sId);
      return res.data;
    },
    enabled: !isNaN(sId) && sId > 0,
  });
}
