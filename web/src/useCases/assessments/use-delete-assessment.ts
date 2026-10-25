import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { assessmentsApi } from "@/services/assessments";
import { assessmentQueryKeys } from "./queryKeys";

export const useDeleteAssessment = (
  opt?: UseMutationOptions<void, Error, number>,
) => {
  const qc = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpt } = opt ?? {};
  return useMutation({
    mutationFn: (id) => assessmentsApi.delete(id).then(() => undefined),
    onSuccess: (data, id, ctx, mutation) => {
      qc.invalidateQueries({ queryKey: assessmentQueryKeys.all });
      userOnSuccess?.(data, id, ctx, mutation);
    },
    ...restOpt,
  });
};
