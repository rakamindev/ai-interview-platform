import { mutationOptions } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { FitGapReportResponse } from "../schemas/fitgap";
import type {
  OverridePayload,
  OverrideResponse,
  RegeneratePortfolioResponse,
} from "../schemas/portfolio";

export const portfolioMutations = {
  all: () => ["portfolio"] as const,
  regenerate: (sessionId: number) =>
    mutationOptions({
      mutationKey: [...portfolioMutations.all(), "regenerate", sessionId] as const,
      mutationFn: async () => {
        return await apiClient.post<RegeneratePortfolioResponse>(`/sessions/${sessionId}/portfolio/regenerate`);
      },
    }),
  triggerFitGap: (portfolioId: number) =>
    mutationOptions({
      mutationKey: [...portfolioMutations.all(), "trigger-fitgap", portfolioId] as const,
      mutationFn: async (vacancyId: number) => {
        return await apiClient.post<FitGapReportResponse>(`/portfolios/${portfolioId}/fitgap`, {
          fitgap: { vacancy_id: vacancyId },
        });
      },
    }),
  regenerateFitGap: (portfolioId: number) =>
    mutationOptions({
      mutationKey: [...portfolioMutations.all(), "regenerate-fitgap", portfolioId] as const,
      mutationFn: async (vacancyId: number) => {
        return await apiClient.post<FitGapReportResponse>(`/portfolios/${portfolioId}/regenerate_fitgap`, {
          vacancy_id: vacancyId,
        });
      },
    }),
  override: (portfolioSkillId: number) =>
    mutationOptions({
      mutationKey: [...portfolioMutations.all(), "override", portfolioSkillId] as const,
      mutationFn: async (payload: OverridePayload) => {
        return await apiClient.post<OverrideResponse>(`/portfolio_skills/${portfolioSkillId}/override`, {
          override: payload,
        });
      },
    }),
  export: (portfolioId: number) =>
    mutationOptions({
      mutationKey: [...portfolioMutations.all(), "export", portfolioId] as const,
      mutationFn: async ({ format, vacancyId }: { format: "pdf" | "json"; vacancyId?: number }) => {
        return await apiClient.download(`/portfolios/${portfolioId}/export`, {
          searchParams: {
            format,
            ...(vacancyId ? { vacancy_id: vacancyId } : {}),
          },
        });
      },
    }),
};
