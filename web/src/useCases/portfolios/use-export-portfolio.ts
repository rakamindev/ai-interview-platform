import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { portfoliosApi } from "@/services/portfolios";

export const useExportPortfolio = (
  opt?: UseMutationOptions<unknown, Error, { portfolioId: number; format: "pdf" | "json"; vacancyId?: number }>,
) => {
  return useMutation({
    mutationFn: ({ portfolioId, format, vacancyId }) =>
      portfoliosApi.exportPortfolio(portfolioId, format, vacancyId).then((r) => r.data),
    ...opt,
  });
};
