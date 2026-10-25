export const skillTaxonomyQueryKeys = {
  all: ["skillTaxonomies"] as const,
  list: () => [...skillTaxonomyQueryKeys.all, "list"] as const,
  detail: (skillId: string) => [...skillTaxonomyQueryKeys.all, "detail", skillId] as const,
};
