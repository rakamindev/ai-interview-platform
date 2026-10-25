import { useQuery, type QueryObserverOptions } from "@tanstack/react-query";
import { sessionsApi } from "@/services/sessions";
import { sessionQueryKeys } from "./queryKeys";

export const useGetCoverage = (
  id: number,
  opt?: Partial<QueryObserverOptions<Awaited<ReturnType<typeof sessionsApi.getCoverage>>["data"], Error>>,
) => {
  return useQuery({
    queryKey: sessionQueryKeys.coverage(id),
    queryFn: () => sessionsApi.getCoverage(id).then((r) => r.data),
    enabled: !!id,
    ...opt,
  });
};
