import { useQuery, type QueryObserverOptions } from "@tanstack/react-query";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";
import { skillTaxonomyQueryKeys } from "./queryKeys";

export const useGetSkillTaxonomies = (
  opt?: Partial<QueryObserverOptions<Awaited<ReturnType<typeof skillTaxonomiesApi.list>>["data"], Error>>,
) => {
  return useQuery({
    queryKey: skillTaxonomyQueryKeys.list(),
    queryFn: () => skillTaxonomiesApi.list().then((r) => r.data),
    ...opt,
  });
};
