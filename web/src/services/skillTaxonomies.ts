import api from "./api";
import type { SkillTaxonomy } from "@/types";

export interface SkillPayload {
  skill_id?: string;
  skill_label: string;
  category: string;
  scope_include?: string;
  scope_exclude?: string;
  l1_anchor?: string;
  l2_anchor?: string;
  l3_anchor?: string;
  l4_anchor?: string;
  l5_anchor?: string;
}

export const skillTaxonomiesApi = {
  list: (category?: string) =>
    api.get<{ skill_taxonomies: SkillTaxonomy[] }>("/skill_taxonomies", {
      params: category ? { category } : undefined,
    }),

  get: (skillId: string) =>
    api.get<{ skill_taxonomy: SkillTaxonomy }>(`/skill_taxonomies/${skillId}`),

  create: (skill: SkillPayload) =>
    api.post<{ skill: SkillTaxonomy }>("/skill_taxonomies", { skill }),

  bulkCreate: (skills: SkillPayload[]) =>
    api.post<{ skills: SkillTaxonomy[]; count: number }>("/skill_taxonomies/bulk", { skills }),

  update: (skillId: string, skill: Partial<SkillPayload>) =>
    api.patch<{ skill: SkillTaxonomy }>(`/skill_taxonomies/${skillId}`, { skill }),

  delete: (skillId: string) =>
    api.delete<{ message: string }>(`/skill_taxonomies/${skillId}`),
};
