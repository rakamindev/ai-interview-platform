import api from "./api";
import type { Vacancy, VacancySkill, PaginationMeta } from "@/types";

export interface VacancyPayload {
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  vacancy_skills_attributes: Partial<VacancySkill>[];
}

export interface VacancyListParams {
  page?: number;
  search?: string;
  sort_by?: "created_at" | "updated_at";
}

export const vacanciesApi = {
  list: (params?: VacancyListParams | number, search?: string) => {
    const options: VacancyListParams =
      typeof params === "number"
        ? { page: params, search }
        : params || {};

    return api.get<{ vacancies: Vacancy[]; meta: PaginationMeta }>("/vacancies", {
      params: {
        page: options.page ?? 1,
        search: options.search?.trim() || undefined,
        sort_by: options.sort_by || undefined,
      },
    });
  },

  get: (id: number) =>
    api.get<{ vacancy: Vacancy }>(`/vacancies/${id}`),

  create: (data: VacancyPayload) =>
    api.post<{ vacancy: Vacancy }>("/vacancies", { vacancy: data }),

  update: (id: number, data: VacancyPayload) =>
    api.put<{ vacancy: Vacancy }>(`/vacancies/${id}`, { vacancy: data }),

  delete: (id: number) => api.delete(`/vacancies/${id}`),
};
