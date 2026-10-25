import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { sessionsApi } from "@/services/sessions";
import { sessionQueryKeys } from "./queryKeys";

export const useEndSession = (
  opt?: UseMutationOptions<Awaited<ReturnType<typeof sessionsApi.endSession>>["data"], Error, { id: number; reason?: string }>,
) => {
  const qc = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpt } = opt ?? {};
  return useMutation({
    mutationFn: ({ id, reason }) => sessionsApi.endSession(id, reason).then((r) => r.data),
    onSuccess: (data, vars, ctx, mutation) => {
      qc.invalidateQueries({ queryKey: sessionQueryKeys.detail(vars.id) });
      userOnSuccess?.(data, vars, ctx, mutation);
    },
    ...restOpt,
  });
};
