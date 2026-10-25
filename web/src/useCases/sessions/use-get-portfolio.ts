import { useQuery, type QueryObserverOptions } from "@tanstack/react-query";
import { sessionsApi } from "@/services/sessions";
import { sessionQueryKeys } from "./queryKeys";

export const useGetPortfolio = (
  id: number,
  opt?: Partial<QueryObserverOptions<Awaited<ReturnType<typeof sessionsApi.getPortfolio>>["data"], Error>>,
) => {
  return useQuery({
    queryKey: sessionQueryKeys.portfolio(id),
    queryFn: () => sessionsApi.getPortfolio(id).then((r) => r.data),
    enabled: !!id,
    ...opt,
  });
};
