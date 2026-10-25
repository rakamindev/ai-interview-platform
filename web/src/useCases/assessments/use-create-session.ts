import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { assessmentsApi } from "@/services/assessments";
import { assessmentQueryKeys } from "./queryKeys";

export const useCreateSession = (
  opt?: UseMutationOptions<
    Awaited<ReturnType<typeof assessmentsApi.createSession>>["data"],
    Error,
    { assessmentId: number; candidateName?: string; candidateId?: number }
  >,
) => {
  const qc = useQueryClient();
  const { onSuccess: userOnSuccess, onError, ...restOpt } = opt ?? {};
  return useMutation({
    mutationFn: ({ assessmentId, candidateName, candidateId }) =>
      assessmentsApi.createSession(assessmentId, candidateName, candidateId).then((r) => r.data),
    onSuccess: (data, vars, ctx, mutation) => {
      qc.invalidateQueries({ queryKey: assessmentQueryKeys.sessions(vars.assessmentId) });
      userOnSuccess?.(data, vars, ctx, mutation);
    },
    onError,
    ...restOpt,
  });
};
