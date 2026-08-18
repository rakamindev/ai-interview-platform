import { mutationOptions } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { CreateVacancy, UpdateVacancy, VacancyDetail } from "../schemas/vacancy";

export const vacancyMutations = {
  all: () => ["vacancy"] as const,
  create: () =>
    mutationOptions({
      mutationKey: [...vacancyMutations.all(), "create"],
      mutationFn: async (payload: CreateVacancy) => {
        return await apiClient.post<{ vacancy: VacancyDetail }>("/vacancies", payload);
      },
    }),
  update: (id: number) =>
    mutationOptions({
      mutationKey: [...vacancyMutations.all(), "update", id],
      mutationFn: async (payload: UpdateVacancy) => {
        return await apiClient.put<{ vacancy: VacancyDetail }>(`/vacancies/${id}`, payload);
      },
    }),
  destroy: (id: number) =>
    mutationOptions({
      mutationKey: [...vacancyMutations.all(), "destroy", id],
      mutationFn: async () => {
        return await apiClient.delete(`/vacancies/${id}`);
      },
    }),
};
