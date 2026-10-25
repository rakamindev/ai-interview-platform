import { useQuery, type QueryObserverOptions } from "@tanstack/react-query";
import { sessionsApi } from "@/services/sessions";
import { sessionQueryKeys } from "./queryKeys";

export const useGetTranscript = (
  id: number,
  fromTurn?: number,
  opt?: Partial<QueryObserverOptions<Awaited<ReturnType<typeof sessionsApi.getTranscript>>["data"], Error>>,
) => {
  return useQuery({
    queryKey: sessionQueryKeys.transcript(id),
    queryFn: () => sessionsApi.getTranscript(id, fromTurn).then((r) => r.data),
    enabled: !!id,
    ...opt,
  });
};
