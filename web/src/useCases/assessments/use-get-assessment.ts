import { useQuery, type QueryObserverOptions } from "@tanstack/react-query";
import { assessmentsApi } from "@/services/assessments";
import { assessmentQueryKeys } from "./queryKeys";

export const useGetAssessment = (
  id: number,
  opt?: Partial<QueryObserverOptions<Awaited<ReturnType<typeof assessmentsApi.get>>["data"], Error>>,
) => {
  return useQuery({
    queryKey: assessmentQueryKeys.detail(id),
    queryFn: () => assessmentsApi.get(id).then((r) => r.data),
    enabled: !!id,
    ...opt,
  });
};
