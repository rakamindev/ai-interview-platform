import api from "./api";
import {
  fitGapReportSchema,
  portfolioSchema,
  parseOrThrow,
} from "./schemas";
import type { Portfolio, AssessorOverride, FitGapReport } from "@/types";

/**
 * Payloads are parsed, not cast.
 *
 * api.ts already unwraps the `{ data: ... }` envelope in a response
 * interceptor, so parsing happens on the unwrapped body.
 */
export const portfoliosApi = {
  saveOverride: (
    portfolioSkillId: number,
    data: { override_level: number; assessor_notes: string },
  ) =>
    api.post<{ override: AssessorOverride }>(
      `/portfolio_skills/${portfolioSkillId}/override`,
      { override: data },
    ),

  triggerFitGap: (portfolioId: number, vacancyId: number) =>
    api.post<{ report: FitGapReport } | { status: string; message: string }>(
      `/portfolios/${portfolioId}/fitgap`,
      { fitgap: { vacancy_id: vacancyId } },
    ),

  getFitGap: async (portfolioId: number, vacancyId: number): Promise<FitGapReport> => {
    const res = await api.get(`/portfolios/${portfolioId}/fitgap/${vacancyId}`);
    return parseOrThrow(
      fitGapReportSchema,
      (res.data as { report: unknown }).report,
      "fit/gap report",
    ) as FitGapReport;
  },

  getPortfolio: async (sessionId: number): Promise<Portfolio | null> => {
    const res = await api.get(`/sessions/${sessionId}/portfolio`);
    const body = res.data as { portfolio?: unknown; status?: string };
    if (!body.portfolio) return null;
    return parseOrThrow(portfolioSchema, body.portfolio, "portfolio") as Portfolio;
  },

  regenerateFitGap: (portfolioId: number, vacancyId: number) =>
    api.post<{ status: string; message: string }>(
      `/portfolios/${portfolioId}/regenerate_fitgap`,
      { vacancy_id: vacancyId },
    ),

  exportPortfolio: (portfolioId: number, format: "pdf" | "json", vacancyId?: number) =>
    api.get(`/portfolios/${portfolioId}/export`, {
      params: { format, ...(vacancyId ? { vacancy_id: vacancyId } : {}) },
      responseType: format === "pdf" ? "blob" : "json",
    }),
};

/** @deprecated Named getOverride but performs a POST. Use saveOverride. */
export const getOverride = portfoliosApi.saveOverride;
