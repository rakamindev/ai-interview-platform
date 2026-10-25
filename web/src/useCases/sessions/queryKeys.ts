export const sessionQueryKeys = {
  all: ["sessions"] as const,
  detail: (id: number) => [...sessionQueryKeys.all, id] as const,
  coverage: (id: number) => [...sessionQueryKeys.all, id, "coverage"] as const,
  transcript: (id: number) => [...sessionQueryKeys.all, id, "transcript"] as const,
  portfolio: (id: number) => [...sessionQueryKeys.all, id, "portfolio"] as const,
  fitGap: (portfolioId: number, vacancyId: number) =>
    ["fitGap", portfolioId, vacancyId] as const,
};
