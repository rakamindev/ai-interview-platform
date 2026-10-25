import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { sessionsApi } from "@/services/sessions";
import { sessionQueryKeys } from "./queryKeys";

export const useMarkPortfolioReviewed = (
  opt?: UseMutationOptions<Awaited<ReturnType<typeof sessionsApi.markPortfolioReviewed>>["data"], Error, number>,
) => {
  const qc = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpt } = opt ?? {};
  return useMutation({
    mutationFn: (id) => sessionsApi.markPortfolioReviewed(id).then((r) => r.data),
    onSuccess: (data, id, ctx, mutation) => {
      qc.invalidateQueries({ queryKey: sessionQueryKeys.portfolio(id) });
      userOnSuccess?.(data, id, ctx, mutation);
    },
    ...restOpt,
  });
};
