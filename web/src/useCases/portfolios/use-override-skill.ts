import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { portfoliosApi } from "@/services/portfolios";

export const useOverrideSkill = (
  opt?: UseMutationOptions<
    Awaited<ReturnType<typeof portfoliosApi.getOverride>>["data"],
    Error,
    { portfolioSkillId: number; data: { override_level: number; assessor_notes: string } }
  >,
) => {
  return useMutation({
    mutationFn: ({ portfolioSkillId, data }) =>
      portfoliosApi.getOverride(portfolioSkillId, data).then((r) => r.data),
    ...opt,
  });
};
