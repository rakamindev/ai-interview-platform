import { useQuery, type QueryObserverOptions } from "@tanstack/react-query";
import { sessionsApi } from "@/services/sessions";
import { sessionQueryKeys } from "./queryKeys";

export const useGetSession = (
  id: number,
  opt?: Partial<QueryObserverOptions<Awaited<ReturnType<typeof sessionsApi.get>>["data"], Error>>,
) => {
  return useQuery({
    queryKey: sessionQueryKeys.detail(id),
    queryFn: () => sessionsApi.get(id).then((r) => r.data),
    enabled: !!id,
    ...opt,
  });
};
