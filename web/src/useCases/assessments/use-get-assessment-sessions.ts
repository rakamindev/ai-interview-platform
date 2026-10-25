import { useQuery, type QueryObserverOptions } from "@tanstack/react-query";
import { assessmentsApi } from "@/services/assessments";
import { assessmentQueryKeys } from "./queryKeys";

export const useGetAssessmentSessions = (
  assessmentId: number,
  opt?: Partial<QueryObserverOptions<Awaited<ReturnType<typeof assessmentsApi.getSessions>>["data"], Error>>,
) => {
  return useQuery({
    queryKey: assessmentQueryKeys.sessions(assessmentId),
    queryFn: () => assessmentsApi.getSessions(assessmentId).then((r) => r.data),
    enabled: !!assessmentId,
    ...opt,
  });
};
