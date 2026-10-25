import { useQuery, type QueryObserverOptions } from "@tanstack/react-query";
import { assessmentsApi } from "@/services/assessments";
import { assessmentQueryKeys } from "./queryKeys";

export const useGetAssessments = (
  page = 1,
  opt?: Partial<QueryObserverOptions<Awaited<ReturnType<typeof assessmentsApi.list>>["data"], Error>>,
) => {
  return useQuery({
    queryKey: assessmentQueryKeys.list(page),
    queryFn: () => assessmentsApi.list(page).then((r) => r.data),
    ...opt,
  });
};
