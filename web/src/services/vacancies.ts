import api from "./api";
import type {PaginationMeta, StatusCount, Vacancy, VacancySkill} from "@/types";

export interface VacancyPayload {
    role_title: string;
    status: string;
    culture_dimensions: string;
    competency_expectations: string;
    vacancy_skills_attributes: Partial<VacancySkill>[];
}

export const vacanciesApi = {
    list: (page = 1) =>
        api.get<{ vacancies: Vacancy[]; meta: PaginationMeta, counters: StatusCount }>("/vacancies", {
            params: {page},
        }),

    get: (id: number) =>
        api.get<{ vacancy: Vacancy }>(`/vacancies/${id}`),

    options: () => api.get<{ vacancies: Vacancy[] }>("/vacancies/options"),

    create: (data: VacancyPayload) =>
        api.post<{ vacancy: Vacancy }>("/vacancies", {vacancy: data}),

    update: (id: number, data: {
        role_title: string;
        status: string;
        culture_dimensions: string;
        competency_expectations: string;
        vacancy_skills_attributes: Partial<VacancySkill>[]
    }) =>
        api.put<{ vacancy: Vacancy }>(`/vacancies/${id}`, {vacancy: data}),

    delete: (id: number) => api.delete(`/vacancies/${id}`),
};
