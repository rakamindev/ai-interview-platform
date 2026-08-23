import api from "@/shared/services/api";
import type { Vacancy, VacancySkill } from "@/features/vacancies/types";
import type { PaginationMeta } from "@/shared/types";

export interface VacancyPayload {
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  vacancy_skills_attributes: Partial<VacancySkill>[];
}

export interface VacancyStats {
  total_skills_tracked: number;
}

export const vacanciesApi = {
  list: (page = 1, q?: string) =>
    api.get<{ vacancies: Vacancy[]; meta: PaginationMeta; stats: VacancyStats }>("/vacancies", {
      params: { page, q },
    }),

  get: (id: number) =>
    api.get<{ vacancy: Vacancy }>(`/vacancies/${id}`),

  create: (data: VacancyPayload) =>
    api.post<{ vacancy: Vacancy }>("/vacancies", { vacancy: data }),

  update: (id: number, data: VacancyPayload) =>
    api.put<{ vacancy: Vacancy }>(`/vacancies/${id}`, { vacancy: data }),

  delete: (id: number) => api.delete(`/vacancies/${id}`),
};
