import api from "./api";
import type { SkillTaxonomy } from "@/types";

export const skillTaxonomiesApi = {
  list: () =>
    api.get<{ skill_taxonomies: SkillTaxonomy[] }>("/skill_taxonomies"),

  get: (skillId: string) =>
    api.get<{ skill_taxonomy: SkillTaxonomy }>(`/skill_taxonomies/${skillId}`),
};
