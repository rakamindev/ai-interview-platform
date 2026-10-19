import api from "./api";
import type { Vacancy, VacancySkill, VacancyStatus, PaginationMeta } from "@/types";

export interface VacancyPayload {
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  vacancy_skills_attributes: Partial<VacancySkill>[];
  status?: VacancyStatus;
}

export interface VacancyListParams {
  page?: number;
  search?: string;
  status?: VacancyStatus;
  signal?: AbortSignal;
}

export const vacanciesApi = {
  list: ({ page = 1, search = "", status, signal }: VacancyListParams = {}) =>
    api.get<{ vacancies: Vacancy[]; meta: PaginationMeta }>("/vacancies", {
      params: { page, search: search || undefined, status },
      signal,
    }),

  get: (id: number) =>
    api.get<{ vacancy: Vacancy }>(`/vacancies/${id}`),

  create: (data: VacancyPayload) =>
    api.post<{ vacancy: Vacancy }>("/vacancies", { vacancy: data }),

  update: (id: number, data: VacancyPayload) =>
    api.put<{ vacancy: Vacancy }>(`/vacancies/${id}`, { vacancy: data }),

  updateStatus: (id: number, status: VacancyStatus) =>
    api.patch<{ vacancy: Vacancy }>(`/vacancies/${id}/status`, { vacancy: { status } }),

  delete: (id: number) => api.delete(`/vacancies/${id}`),
};
