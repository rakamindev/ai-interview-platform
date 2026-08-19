import api, { parseResponse } from "./api";
import { VacancySchema, VacancySkillSchema } from "@/schemas/vacancy";
import type { Vacancy, VacancySkill, PaginationMeta } from "@/types";

const EMPTY_VACANCY: Vacancy = {
  id: 0,
  role_title: "",
  culture_dimensions: "",
  competency_expectations: ""
};

export interface VacancyPayload {
  role_title: string;
  culture_dimensions: string;
  competency_expectations: string;
  vacancy_skills_attributes: Partial<VacancySkill>[];
}

export const vacanciesApi = {
  list: (page = 1) =>
    api.get("/vacancies", { params: { page } }).then((res) => {
      const raw = res.data as any;
      return {
        ...res,
        data: {
          vacancies: Array.isArray(raw?.vacancies)
            ? raw.vacancies
                .map((v: unknown) => parseResponse(v, VacancySchema, EMPTY_VACANCY))
                .filter((v: Vacancy) => v.id !== 0)
            : [],
          meta: raw?.meta ?? { current_page: 1, total_pages: 1, total_count: 0, per_page: 10 }
        }
      };
    }),

  get: (id: number) =>
    api.get(`/vacancies/${id}`).then((res) => {
      const raw = res.data as any;
      return {
        ...res,
        data: { vacancy: parseResponse(raw?.vacancy, VacancySchema, EMPTY_VACANCY) }
      };
    }),

  create: (data: VacancyPayload) =>
    api.post("/vacancies", { vacancy: data }).then((res) => {
      const raw = res.data as any;
      return {
        ...res,
        data: { vacancy: parseResponse(raw?.vacancy, VacancySchema, EMPTY_VACANCY) }
      };
    }),

  update: (id: number, data: VacancyPayload) =>
    api.put(`/vacancies/${id}`, { vacancy: data }).then((res) => {
      const raw = res.data as any;
      return {
        ...res,
        data: { vacancy: parseResponse(raw?.vacancy, VacancySchema, EMPTY_VACANCY) }
      };
    }),

  delete: (id: number) => api.delete(`/vacancies/${id}`)
};
