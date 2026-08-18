import { queryOptions } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { VacancyDetail, VacancyList, VacancySearch } from "../schemas/vacancy";

export const vacancyQueries = {
  all: () => ["vacancy"] as const,
  listKey: (filters: VacancySearch) => [...vacancyQueries.all(), "list", filters] as const,
  list: (filters: VacancySearch) =>
    queryOptions({
      queryKey: vacancyQueries.listKey(filters),
      queryFn: async ({ signal }) =>
        await apiClient.get<VacancyList>("/vacancies", {
          searchParams: filters,
          signal,
        }),
    }),
  detailKey: (id: number) => [...vacancyQueries.all(), "detail", id] as const,
  detail: (id: number) =>
    queryOptions({
      queryKey: vacancyQueries.detailKey(id),
      queryFn: async ({ signal }) =>
        await apiClient.get<{ vacancy: VacancyDetail }>(`/vacancies/${id}`, {
          signal,
        }),
    }),
};
