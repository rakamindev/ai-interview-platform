import { useQuery, type QueryObserverOptions } from "@tanstack/react-query";
import { vacanciesApi } from "@/services/vacancies";
import { vacancyQueryKeys } from "./queryKeys";

export const useGetVacancies = (
  page = 1,
  opt?: Partial<QueryObserverOptions<Awaited<ReturnType<typeof vacanciesApi.list>>["data"], Error>>,
) => {
  return useQuery({
    queryKey: vacancyQueryKeys.list(page),
    queryFn: () => vacanciesApi.list(page).then((r) => r.data),
    ...opt,
  });
};
