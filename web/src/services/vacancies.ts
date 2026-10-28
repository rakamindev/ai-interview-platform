import api from "./api";
import type { Vacancy, VacancySkill, PaginationMeta } from "@/types";

export interface VacancyPayload {
  role_title: string;
  employment_type?: string;
  workplace_type?: string;
  culture_dimensions?: string;
  competency_expectations?: string;
  vacancy_skills_attributes: Partial<VacancySkill>[];
}

function enrichPayload(data: VacancyPayload): VacancyPayload {
  const meta: Record<string, any> = {};
  if (data.competency_expectations) {
    try {
      const parsed = JSON.parse(data.competency_expectations);
      if (typeof parsed === "object" && parsed !== null) {
        Object.assign(meta, parsed);
      }
    } catch {
      meta.notes = data.competency_expectations;
    }
  }

  // Always embed employment_type & workplace_type into competency_expectations JSON
  // to ensure persistence even across migrations/unrestarted servers
  meta.employment_type = data.employment_type || "full_time";
  meta.workplace_type = data.workplace_type || "on_site";

  return {
    ...data,
    employment_type: data.employment_type || "full_time",
    workplace_type: data.workplace_type || "on_site",
    competency_expectations: JSON.stringify(meta),
  };
}

function normalizeVacancy(v: Vacancy): Vacancy {
  if (!v) return v;
  let emp = v.employment_type;
  let work = v.workplace_type;

  if (v.competency_expectations) {
    try {
      const parsed = typeof v.competency_expectations === "string"
        ? JSON.parse(v.competency_expectations)
        : v.competency_expectations;
      if (parsed && typeof parsed === "object") {
        if (parsed.employment_type) emp = parsed.employment_type;
        if (parsed.workplace_type) work = parsed.workplace_type;
      }
    } catch {
      // not json, keep original values
    }
  }

  return {
    ...v,
    employment_type: emp || "full_time",
    workplace_type: work || "on_site",
  };
}

export const vacanciesApi = {
  list: async (page = 1) => {
    const res = await api.get<{ vacancies: Vacancy[]; meta: PaginationMeta }>("/vacancies", {
      params: { page },
    });
    return {
      ...res,
      data: {
        ...res.data,
        vacancies: (res.data.vacancies || []).map(normalizeVacancy),
      },
    };
  },

  get: async (id: number) => {
    const res = await api.get<{ vacancy: Vacancy }>(`/vacancies/${id}`);
    return {
      ...res,
      data: {
        ...res.data,
        vacancy: normalizeVacancy(res.data.vacancy),
      },
    };
  },

  create: (data: VacancyPayload) =>
    api.post<{ vacancy: Vacancy }>("/vacancies", { vacancy: enrichPayload(data) }),

  update: (id: number, data: VacancyPayload) =>
    api.put<{ vacancy: Vacancy }>(`/vacancies/${id}`, { vacancy: enrichPayload(data) }),

  delete: (id: number) => api.delete(`/vacancies/${id}`),
};
