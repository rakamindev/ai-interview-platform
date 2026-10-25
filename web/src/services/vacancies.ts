import api from "./api";
import type { Vacancy, VacancySkill, PaginationMeta } from "@/types";

export interface VacancyPayload {
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  vacancy_skills_attributes: Partial<VacancySkill>[];
}

export const vacanciesApi = {
  list: (page = 1, archived = false, search = "") =>
    api.get<{ vacancies: Vacancy[]; meta: PaginationMeta }>("/vacancies", {
      params: { page, archived, ...(search.trim() ? { search: search.trim() } : {}) },
    }),

  get: (id: number) =>
    api.get<{ vacancy: Vacancy }>(`/vacancies/${id}`),

  create: (data: VacancyPayload) =>
    api.post<{ vacancy: Vacancy }>("/vacancies", { vacancy: data }),

  update: (id: number, data: VacancyPayload) =>
    api.put<{ vacancy: Vacancy }>(`/vacancies/${id}`, { vacancy: data }),

  delete: (id: number) => api.delete(`/vacancies/${id}`),
  archive: (id: number) => api.patch(`/vacancies/${id}/archive`),
  unarchive: (id: number) => api.patch(`/vacancies/${id}/unarchive`),
  bulkArchive: (ids: number[]) => api.post("/vacancies/bulk_archive", { ids }),
  bulkUnarchive: (ids: number[]) => api.post("/vacancies/bulk_unarchive", { ids }),
};
