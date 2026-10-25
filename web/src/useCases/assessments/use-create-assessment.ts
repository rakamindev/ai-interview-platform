import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { assessmentsApi, type AssessmentPayload } from "@/services/assessments";
import { assessmentQueryKeys } from "./queryKeys";

export const useCreateAssessment = (
  opt?: UseMutationOptions<Awaited<ReturnType<typeof assessmentsApi.create>>["data"], Error, AssessmentPayload>,
) => {
  const qc = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpt } = opt ?? {};
  return useMutation({
    mutationFn: (data) => assessmentsApi.create(data).then((r) => r.data),
    onSuccess: (data, vars, ctx, mutation) => {
      qc.invalidateQueries({ queryKey: assessmentQueryKeys.all });
      userOnSuccess?.(data, vars, ctx, mutation);
    },
    ...restOpt,
  });
};
