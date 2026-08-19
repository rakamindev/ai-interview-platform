import api from "./api";
import type { Vacancy, VacancySkill, PaginationMeta, WorkArrangement, EmploymentType } from "@/types";

export interface VacancyPayload {
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  address?: string;
  city?: string;
  work_arrangement?: WorkArrangement | "";
  employment_type?: EmploymentType | "";
  department?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_visible?: boolean;
  description?: string;
  application_deadline?: string;
  vacancy_skills_attributes: Partial<VacancySkill>[];
}

export const vacanciesApi = {
  list: (page = 1, q?: string) =>
    api.get<{ vacancies: Vacancy[]; meta: PaginationMeta }>("/vacancies", {
      params: { page, ...(q ? { q } : {}) },
    }),

  get: (id: number) =>
    api.get<{ vacancy: Vacancy }>(`/vacancies/${id}`),

  create: (data: VacancyPayload) =>
    api.post<{ vacancy: Vacancy }>("/vacancies", { vacancy: data }),

  update: (id: number, data: VacancyPayload) =>
    api.put<{ vacancy: Vacancy }>(`/vacancies/${id}`, { vacancy: data }),

  delete: (id: number) => api.delete(`/vacancies/${id}`),
};
