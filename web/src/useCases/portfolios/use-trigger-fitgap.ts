import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { portfoliosApi } from "@/services/portfolios";
import { portfolioQueryKeys } from "./queryKeys";

export const useTriggerFitGap = (
  opt?: UseMutationOptions<
    Awaited<ReturnType<typeof portfoliosApi.triggerFitGap>>["data"],
    Error,
    { portfolioId: number; vacancyId: number }
  >,
) => {
  const qc = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpt } = opt ?? {};
  return useMutation({
    mutationFn: ({ portfolioId, vacancyId }) =>
      portfoliosApi.triggerFitGap(portfolioId, vacancyId).then((r) => r.data),
    onSuccess: (data, vars, ctx, mutation) => {
      qc.invalidateQueries({
        queryKey: portfolioQueryKeys.fitGap(vars.portfolioId, vars.vacancyId),
      });
      userOnSuccess?.(data, vars, ctx, mutation);
    },
    ...restOpt,
  });
};
