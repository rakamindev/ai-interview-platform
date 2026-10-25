import { useQuery, type QueryObserverOptions } from "@tanstack/react-query";
import { portfoliosApi } from "@/services/portfolios";
import { portfolioQueryKeys } from "./queryKeys";

export const useGetFitGap = (
  portfolioId: number,
  vacancyId: number,
  opt?: Partial<QueryObserverOptions<Awaited<ReturnType<typeof portfoliosApi.getFitGap>>["data"], Error>>,
) => {
  return useQuery({
    queryKey: portfolioQueryKeys.fitGap(portfolioId, vacancyId),
    queryFn: () => portfoliosApi.getFitGap(portfolioId, vacancyId).then((r) => r.data),
    enabled: !!portfolioId && !!vacancyId,
    ...opt,
  });
};
