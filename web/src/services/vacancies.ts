import api from "./api";
import type { Vacancy, VacancySkill, PaginationMeta } from "@/types";

export interface VacancyPayload {
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  vacancy_skills_attributes: Partial<VacancySkill>[];
}

export const vacanciesApi = {
  list: (page = 1, perPage?: number) =>
    api.get<{ vacancies: Vacancy[]; meta: PaginationMeta }>("/vacancies", {
      params: { page, per_page: perPage },
    }),

  // Pickers need every vacancy, but the index is paginated (max 100 per page), so fetch all pages.
  listAll: async (): Promise<Vacancy[]> => {
    const first = await vacanciesApi.list(1, 100);
    const rest = await Promise.all(
      Array.from({ length: Math.max(first.data.meta.total_pages - 1, 0) }, (_, i) => vacanciesApi.list(i + 2, 100))
    );
    return [first, ...rest].flatMap((res) => res.data.vacancies);
  },

  get: (id: number) =>
    api.get<{ vacancy: Vacancy }>(`/vacancies/${id}`),

  create: (data: VacancyPayload) =>
    api.post<{ vacancy: Vacancy }>("/vacancies", { vacancy: data }),

  update: (id: number, data: VacancyPayload) =>
    api.put<{ vacancy: Vacancy }>(`/vacancies/${id}`, { vacancy: data }),

  delete: (id: number) => api.delete(`/vacancies/${id}`),
};
