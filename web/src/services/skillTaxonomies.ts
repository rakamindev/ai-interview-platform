import api from "./api";
import type { SkillTaxonomy } from "@/types";

export interface SkillTaxonomySuggestion extends SkillTaxonomy {
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

export const skillTaxonomiesApi = {
  list: () =>
    api.get<{ skill_taxonomies: SkillTaxonomy[] }>("/skill_taxonomies"),

  get: (skillId: string) =>
    api.get<{ skill_taxonomy: SkillTaxonomy }>(`/skill_taxonomies/${skillId}`),

  suggest: (skillLabel: string) =>
    api.post<{ suggestion: SkillTaxonomySuggestion | null }>("/skill_taxonomies/suggest", {
      skill_label: skillLabel,
    }),
};
