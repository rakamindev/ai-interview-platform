import { z } from "zod";

export const assessmentSkillSchema = z.object({
  skill_id: z.string().max(50).optional(),
  skill_label: z.string().min(1).max(255),
  is_custom: z.boolean().optional(),
  scope_include: z.string().min(1, "Skill scope is required"),
  scope_exclude: z.string().optional(),
  l1_anchor: z.string().min(1, "Skill anchors L1-L5 are required"),
  l2_anchor: z.string().min(1, "Skill anchors L1-L5 are required"),
  l3_anchor: z.string().min(1, "Skill anchors L1-L5 are required"),
  l4_anchor: z.string().min(1, "Skill anchors L1-L5 are required"),
  l5_anchor: z.string().min(1, "Skill anchors L1-L5 are required"),
  expected_level: z.number().int().min(1).max(5).optional(),
}).refine((skill) => skill.is_custom || Boolean(skill.skill_id), {
  message: "Skill id is required",
  path: ["skill_id"],
});

export const assessmentSchema = z.object({
  name: z.string().min(1).max(255),
  time_limit_min: z.union([z.literal(10), z.literal(30), z.literal(45), z.literal(60), z.literal(90)]),
  language: z.enum(["en", "id"]).optional(),
  skills: z.array(assessmentSkillSchema).min(1),
});
export type AssessmentValues = z.infer<typeof assessmentSchema>;
