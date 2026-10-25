import { useQuery, type QueryObserverOptions } from "@tanstack/react-query";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import { skillTaxonomyQueryKeys } from "./queryKeys";

export const useGetSkillTaxonomy = (
  skillId: string,
  opt?: Partial<QueryObserverOptions<Awaited<ReturnType<typeof skillTaxonomiesApi.get>>["data"], Error>>,
) => {
  return useQuery({
    queryKey: skillTaxonomyQueryKeys.detail(skillId),
    queryFn: () => skillTaxonomiesApi.get(skillId).then((r) => r.data),
    enabled: !!skillId,
    ...opt,
  });
};
