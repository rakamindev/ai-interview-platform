export const portfolioQueryKeys = {
  all: ["portfolios"] as const,
  fitGap: (portfolioId: number, vacancyId: number) =>
    [...portfolioQueryKeys.all, portfolioId, "fitGap", vacancyId] as const,
};
