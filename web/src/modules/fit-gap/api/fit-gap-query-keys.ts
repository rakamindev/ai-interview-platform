export const fitGapQueryKeys = {
  all: ["fit-gap"] as const,
  context: (sessionId: number, vacancyId: number) =>
    [...fitGapQueryKeys.all, "context", sessionId, vacancyId] as const,
  report: (portfolioId: number, vacancyId: number) =>
    [...fitGapQueryKeys.all, "report", portfolioId, vacancyId] as const,
};
