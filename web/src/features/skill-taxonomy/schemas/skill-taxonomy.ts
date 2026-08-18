import * as v from "valibot";

export const skillTaxonomySchema = v.object({
  skill_id: v.string(),
  skill_label: v.string(),
  category: v.string(),
  scope_include: v.string(),
  scope_exclude: v.string(),
  l1_anchor: v.string(),
  l2_anchor: v.string(),
  l3_anchor: v.string(),
  l4_anchor: v.string(),
  l5_anchor: v.string(),
});

export const skillTaxonomyListSchema = v.object({
  skill_taxonomies: v.array(skillTaxonomySchema),
});

export type SkillTaxonomy = v.InferOutput<typeof skillTaxonomySchema>;
export type SkillTaxonomyList = v.InferOutput<typeof skillTaxonomyListSchema>;
