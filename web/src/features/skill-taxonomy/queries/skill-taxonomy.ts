import { queryOptions } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";

import type { SkillTaxonomyList } from "../schemas/skill-taxonomy";

export const skillTaxonomyQueries = {
  all: () => ["skill-taxonomy"] as const,
  listKey: () => [...skillTaxonomyQueries.all(), "list"] as const,
  list: () =>
    queryOptions({
      queryKey: skillTaxonomyQueries.listKey(),
      queryFn: async ({ signal }) =>
        await apiClient.get<SkillTaxonomyList>("/skill_taxonomies", {
          signal,
        }),
    }),
};
