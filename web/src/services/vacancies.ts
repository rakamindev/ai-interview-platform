import api from "./api";
import type { Vacancy, VacancySkill, PaginationMeta } from "@/types";

export interface VacancyPayload {
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  vacancy_skills_attributes: Partial<VacancySkill>[];
}

interface VacancyListOptions {
  page?: number;
  perPage?: number;
}

export const vacanciesApi = {
  list: ({ page = 1, perPage }: VacancyListOptions = {}) =>
    api.get<{ vacancies: Vacancy[]; meta: PaginationMeta }>("/vacancies", {
      params: { page, ...(perPage === undefined ? {} : { per_page: perPage }) },
    }),

  get: (id: number) =>
    api.get<{ vacancy: Vacancy }>(`/vacancies/${id}`),

  create: (data: VacancyPayload) =>
    api.post<{ vacancy: Vacancy }>("/vacancies", { vacancy: data }),

  update: (id: number, data: VacancyPayload) =>
    api.put<{ vacancy: Vacancy }>(`/vacancies/${id}`, { vacancy: data }),

  delete: (id: number) => api.delete(`/vacancies/${id}`),
};
