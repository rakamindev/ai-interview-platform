import api from "./api";
import type { Vacancy, VacancySkill, PaginationMeta } from "@/types";

export interface VacancyPayload {
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  location?: string;
  experience_level?: "intern" | "associate" | "mid" | "senior" | "lead";
  experience_years_min?: number;
  experience_years_max?: number;
  work_arrangement?: "onsite" | "hybrid" | "remote";
  employment_type?: "full_time" | "contract" | "internship";
  minimum_education?: string;
  salary_min?: number;
  salary_max?: number;
  vacancy_skills_attributes: Partial<VacancySkill>[];
}

export const vacanciesApi = {
  list: (page = 1) =>
    api.get<{ vacancies: Vacancy[]; meta: PaginationMeta }>("/vacancies", {
      params: { page },
    }),

  get: (id: number) =>
    api.get<{ vacancy: Vacancy }>(`/vacancies/${id}`),

  create: (data: VacancyPayload) =>
    api.post<{ vacancy: Vacancy }>("/vacancies", { vacancy: data }),

  update: (id: number, data: VacancyPayload) =>
    api.put<{ vacancy: Vacancy }>(`/vacancies/${id}`, { vacancy: data }),

  delete: (id: number) => api.delete(`/vacancies/${id}`),
};
