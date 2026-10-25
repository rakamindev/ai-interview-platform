import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { sessionsApi } from "@/services/sessions";
import { sessionQueryKeys } from "./queryKeys";

export const useRegeneratePortfolio = (
  opt?: UseMutationOptions<Awaited<ReturnType<typeof sessionsApi.regeneratePortfolio>>["data"], Error, number>,
) => {
  const qc = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpt } = opt ?? {};
  return useMutation({
    mutationFn: (id) => sessionsApi.regeneratePortfolio(id).then((r) => r.data),
    onSuccess: (data, id, ctx, mutation) => {
      qc.invalidateQueries({ queryKey: sessionQueryKeys.portfolio(id) });
      userOnSuccess?.(data, id, ctx, mutation);
    },
    ...restOpt,
  });
};
