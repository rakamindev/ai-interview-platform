import { z } from "zod";

export const VacancySkillSchema = z.object({
  id: z.number().nullable().optional(),
  skill_id: z.string().nullable().optional(),
  skill_label: z.string(),
  expected_level: z.number(),
  _destroy: z.boolean().optional(),
});

export const VacancySchema = z.object({
  id: z.number(),
  role_title: z.string(),
  culture_dimensions: z.string(),
  competency_expectations: z.string(),
  created_by: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  skills: z.array(VacancySkillSchema).optional(),
});

export type Vacancy = z.infer<typeof VacancySchema>;
export type VacancySkill = z.infer<typeof VacancySkillSchema>;
