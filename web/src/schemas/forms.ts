import { z } from "zod";

export const AssessmentFormSchema = z.object({
  name: z.string().min(1, "Role title is required"),
  time_limit_min: z.number().min(1, "Time limit is required"),
  language: z.enum(["en", "id"]),
  skills: z
    .array(
      z.object({
        id: z.number().optional(),
        skill_id: z.string().optional(),
        skill_label: z.string().optional(),
        is_custom: z.boolean().optional(),
        expected_level: z.number().optional(),
        display_order: z.number().optional(),
        scope_include: z.string().optional(),
        scope_exclude: z.string().optional(),
        l1_anchor: z.string().optional(),
        l2_anchor: z.string().optional(),
        l3_anchor: z.string().optional(),
        l4_anchor: z.string().optional(),
        l5_anchor: z.string().optional(),
        _destroy: z.boolean().optional()
      })
    )
    .min(1, "Add at least one skill")
});

export type AssessmentFormValues = z.infer<typeof AssessmentFormSchema>;

export const VacancyFormSchema = z.object({
  role_title: z.string().min(1, "Role title is required"),
  culture_dimensions: z.string(),
  competency_expectations: z.string(),
  skills: z.array(
    z.object({
      id: z.number().nullable().optional(),
      skill_id: z.string().nullable().optional(),
      skill_label: z.string().optional(),
      expected_level: z.number().optional(),
      _destroy: z.boolean().optional()
    })
  )
});

export type VacancyFormValues = z.infer<typeof VacancyFormSchema>;
