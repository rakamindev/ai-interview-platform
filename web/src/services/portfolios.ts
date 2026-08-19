import api from "./api";
import type { AssessorOverride, FitGapReport, PortfolioNote } from "@/types";

export const portfoliosApi = {
  getOverride: (portfolioSkillId: number, data: { override_level: number; assessor_notes: string }) =>
    api.post<{ override: AssessorOverride }>(`/portfolio_skills/${portfolioSkillId}/override`, {
      override: data,
    }),

  triggerFitGap: (portfolioId: number, vacancyId: number) =>
    api.post<{ report: FitGapReport } | { status: string; message: string }>(`/portfolios/${portfolioId}/fitgap`, {
      fitgap: { vacancy_id: vacancyId },
    }),

  getFitGap: (portfolioId: number, vacancyId: number) =>
    api.get<{ report: FitGapReport }>(`/portfolios/${portfolioId}/fitgap/${vacancyId}`),

  regenerateFitGap: (portfolioId: number, vacancyId: number) =>
    api.post<{ status: string; message: string }>(`/portfolios/${portfolioId}/regenerate_fitgap`, {
      vacancy_id: vacancyId,
    }),

  exportPortfolio: (portfolioId: number, format: "pdf" | "json", vacancyId?: number) =>
    api.get(`/portfolios/${portfolioId}/export`, {
      params: { format, ...(vacancyId ? { vacancy_id: vacancyId } : {}) },
      responseType: format === "pdf" ? "blob" : "json",
    }),

  getNotes: (portfolioId: number) =>
    api.get<{ notes: PortfolioNote[] }>(`/portfolios/${portfolioId}/notes`),

  createNote: (portfolioId: number, body: string, category: PortfolioNote["category"]) =>
    api.post<{ note: PortfolioNote }>(`/portfolios/${portfolioId}/notes`, { note: { body, category } }),
};
