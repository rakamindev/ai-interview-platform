import api from "./api";
import type { Portfolio, AssessorOverride, FitGapReport } from "@/types";
import { fitGapResponseSchema } from "@/types/contracts";

export const portfoliosApi = {
  getOverride: (portfolioSkillId: number, data: { override_level: number; assessor_notes: string }) =>
    api.post<{ override: AssessorOverride }>(`/portfolio_skills/${portfolioSkillId}/override`, {
      override: data,
    }),

  triggerFitGap: async (portfolioId: number, vacancyId: number) => {
    const response = await api.post(`/portfolios/${portfolioId}/fitgap`, {
      fitgap: { vacancy_id: vacancyId },
    });
    return { ...response, data: fitGapResponseSchema.parse(response.data) };
  },

  getFitGap: async (portfolioId: number, vacancyId: number) => {
    const response = await api.get(`/portfolios/${portfolioId}/fitgap/${vacancyId}`);
    return { ...response, data: fitGapResponseSchema.parse(response.data) };
  },

  regenerateFitGap: (portfolioId: number, vacancyId: number) =>
    api.post<{ status: string; message: string }>(`/portfolios/${portfolioId}/regenerate_fitgap`, {
      vacancy_id: vacancyId,
    }),

  exportPortfolio: (portfolioId: number, format: "pdf" | "json", vacancyId?: number) =>
    api.get(`/portfolios/${portfolioId}/export`, {
      params: { format, ...(vacancyId ? { vacancy_id: vacancyId } : {}) },
      responseType: format === "pdf" ? "blob" : "json",
    }),
};
