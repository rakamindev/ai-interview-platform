import { queryOptions } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { FitGapReportResponse } from "../schemas/fitgap";
import type { PortfolioResponse } from "../schemas/portfolio";

export const portfolioQueries = {
  all: () => ["portfolio"] as const,
  bySessionKey: (sessionId: number) => [...portfolioQueries.all(), "session", sessionId] as const,
  bySession: (sessionId: number) =>
    queryOptions({
      queryKey: portfolioQueries.bySessionKey(sessionId),
      queryFn: async ({ signal }) =>
        await apiClient.get<PortfolioResponse>(`/sessions/${sessionId}/portfolio`, {
          signal,
        }),
    }),
  fitGapKey: (portfolioId: number, vacancyId: number) =>
    [...portfolioQueries.all(), "fitgap", portfolioId, vacancyId] as const,
  fitGap: (portfolioId: number, vacancyId: number) =>
    queryOptions({
      queryKey: portfolioQueries.fitGapKey(portfolioId, vacancyId),
      queryFn: async ({ signal }) =>
        await apiClient.get<FitGapReportResponse>(`/portfolios/${portfolioId}/fitgap/${vacancyId}`, {
          signal,
        }),
    }),
};
