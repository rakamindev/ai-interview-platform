import * as v from "valibot";

import { paginatedList, paginatedParams } from "@/utils/type";

export const vacancySchema = v.object({
  id: v.number(),
  role_title: v.string(),
  culture_dimensions: v.nullable(v.string()),
  competency_expectations: v.nullable(v.string()),
  created_by: v.number(),
  created_at: v.string(),
  updated_at: v.string(),
});

export const vacancySkillSchema = v.object({
  id: v.number(),
  skill_id: v.nullable(v.string()),
  skill_label: v.string(),
  expected_level: v.number(),
  l1_anchor: v.nullable(v.string()),
  l2_anchor: v.nullable(v.string()),
  l3_anchor: v.nullable(v.string()),
  l4_anchor: v.nullable(v.string()),
  l5_anchor: v.nullable(v.string()),
});

export const vacancyDetailSchema = v.object({
  ...vacancySchema.entries,
  skills: v.array(vacancySkillSchema),
});

export const vacancySkillCreateSchema = v.object({
  skill_id: v.nullable(v.string()),
  skill_label: v.string(),
  expected_level: v.number(),
});

export const createVacancySchema = v.object({
  role_title: v.pipe(v.string(), v.minLength(1)),
  culture_dimensions: v.optional(v.string()),
  competency_expectations: v.optional(v.string()),
  vacancy_skills_attributes: v.pipe(v.array(vacancySkillCreateSchema), v.minLength(1)),
});

export const updateVacancySkillSchema = v.object({
  id: v.optional(v.number()),
  skill_id: v.nullable(v.string()),
  skill_label: v.string(),
  expected_level: v.number(),
  _destroy: v.optional(v.boolean()),
});

export const updateVacancySchema = v.object({
  role_title: v.pipe(v.string(), v.minLength(1)),
  culture_dimensions: v.optional(v.string()),
  competency_expectations: v.optional(v.string()),
  vacancy_skills_attributes: v.pipe(v.array(updateVacancySkillSchema), v.minLength(1)),
});

export const vacancyListSchema = paginatedList("vacancies", vacancySchema);

export const vacancySearchSchema = paginatedParams();

export type Vacancy = v.InferOutput<typeof vacancySchema>;
export type VacancyList = v.InferOutput<typeof vacancyListSchema>;
export type VacancySearch = v.InferOutput<typeof vacancySearchSchema>;
export type VacancyDetail = v.InferOutput<typeof vacancyDetailSchema>;
export type CreateVacancy = v.InferOutput<typeof createVacancySchema>;
export type UpdateVacancy = v.InferOutput<typeof updateVacancySchema>;
