import api from "./api";
import type { Portfolio, AssessorOverride, FitGapReport } from "@/types";

export const portfoliosApi = {
  getOverride: (portfolioSkillId: number, data: { override_level: number; assessor_notes: string }) =>
    api.post<{ override: AssessorOverride | null; restored?: boolean }>(`/portfolio_skills/${portfolioSkillId}/override`, {
      override: data,
    }),

  triggerFitGap: (portfolioId: number, vacancyId: number, portfolioRevisionId?: number) =>
    api.post<{ report: FitGapReport } | { status: string; message: string }>(`/portfolios/${portfolioId}/fitgap`, {
      fitgap: { vacancy_id: vacancyId, ...(portfolioRevisionId ? { portfolio_revision_id: portfolioRevisionId } : {}) },
    }),

  getFitGap: (portfolioId: number, vacancyId: number, portfolioRevisionId?: number) =>
    api.get<{ report: FitGapReport }>(`/portfolios/${portfolioId}/fitgap/${vacancyId}`, {
      params: portfolioRevisionId ? { portfolio_revision_id: portfolioRevisionId } : undefined,
    }),

  regenerateFitGap: (portfolioId: number, vacancyId: number, portfolioRevisionId?: number) =>
    api.post<{ status: string; message: string }>(`/portfolios/${portfolioId}/regenerate_fitgap`, {
      vacancy_id: vacancyId,
      ...(portfolioRevisionId ? { portfolio_revision_id: portfolioRevisionId } : {}),
    }),

  exportPortfolio: (
    portfolioId: number,
    format: "pdf" | "json",
    vacancyId?: number,
    revisionId?: number
  ) =>
    api.get(`/portfolios/${portfolioId}/export`, {
      params: {
        format,
        ...(vacancyId ? { vacancy_id: vacancyId } : {}),
        ...(revisionId ? { revision_id: revisionId } : {}),
      },
      responseType: format === "pdf" ? "blob" : "json",
    }),
};
