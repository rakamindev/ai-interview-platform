import { useQuery, type QueryObserverOptions } from "@tanstack/react-query";
import { vacanciesApi } from "@/services/vacancies";
import { vacancyQueryKeys } from "./queryKeys";

export const useGetVacancy = (
  id: number,
  opt?: Partial<QueryObserverOptions<Awaited<ReturnType<typeof vacanciesApi.get>>["data"], Error>>,
) => {
  return useQuery({
    queryKey: vacancyQueryKeys.detail(id),
    queryFn: () => vacanciesApi.get(id).then((r) => r.data),
    enabled: !!id,
    ...opt,
  });
};
