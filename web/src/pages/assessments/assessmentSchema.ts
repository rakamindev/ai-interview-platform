import { z } from "zod";

export const skillSchema = z.object({
  id: z.number().optional(),
  skill_id: z.number().optional().nullable(),
  skill_label: z
    .string()
    .trim()
    .min(1, { message: "Skill name is required." })
    .max(128, { message: "Maximum 128 characters allowed." }),
  is_custom: z.boolean(),
  expected_level: z.number(),
  display_order: z.number(),
  scope_include: z
    .string()
    .trim()
    .min(1, { message: "This field is required." }),
  scope_exclude: z.string().optional().nullable(),
  l1_anchor: z
    .string()
    .trim()
    .min(1, { message: "This field is required." }),
  l2_anchor: z
    .string()
    .trim()
    .min(1, { message: "This field is required." }),
  l3_anchor: z
    .string()
    .trim()
    .min(1, { message: "This field is required." }),
  l4_anchor: z
    .string()
    .trim()
    .min(1, { message: "This field is required." }),
  l5_anchor: z
    .string()
    .trim()
    .min(1, { message: "This field is required." }),
  _destroy: z.boolean().optional(),
});

export const assessmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, {
      message: "Role title is required.",
    })
    .max(128, {
      message: "Maximum 128 characters allowed.",
    }),
  time_limit_min: z.number(),
  language: z.enum(["en", "id"]),
  skills: z
    .array(skillSchema)
    .min(1, { message: "Add at least one skill to continue." }),
});