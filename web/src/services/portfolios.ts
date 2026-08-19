import api, { parseResponse } from "./api";
import { PortfolioSchema, AssessorOverrideSchema } from "@/schemas/portfolio";
import { FitGapReportSchema } from "@/schemas/fitgap";
import type { Portfolio, AssessorOverride, FitGapReport } from "@/types";

const EMPTY_PORTFOLIO: Portfolio = {
  id: 0,
  session_id: 0,
  generation_status: "pending",
  skills: [],
  overrides: []
};

const EMPTY_FITGAP: FitGapReport = {
  id: 0,
  portfolio_id: 0,
  vacancy_id: 0,
  skill_comparisons: [],
  culture_narrative: "",
  overall_narrative: "",
  generated_at: ""
};

export const portfoliosApi = {
  getOverride: (
    portfolioSkillId: number,
    data: { override_level: number; assessor_notes: string }
  ) =>
    api.post<{ override: AssessorOverride }>(`/portfolio_skills/${portfolioSkillId}/override`, {
      override: data
    }),

  getOverrideHistory: (portfolioSkillId: number) =>
    api.get<{ override_events: AssessorOverride[] }>(
      `/portfolio_skills/${portfolioSkillId}/override_events`
    ),

  triggerFitGap: (portfolioId: number, vacancyId: number) =>
    api.post<{ report: FitGapReport } | { status: string; message: string }>(
      `/portfolios/${portfolioId}/fitgap`,
      {
        fitgap: { vacancy_id: vacancyId }
      }
    ),

  getFitGap: (portfolioId: number, vacancyId: number) =>
    api.get(`/portfolios/${portfolioId}/fitgap/${vacancyId}`).then((res) => ({
      ...res,
      data: { report: parseResponse((res.data as any)?.report, FitGapReportSchema, EMPTY_FITGAP) }
    })),

  regenerateFitGap: (portfolioId: number, vacancyId: number) =>
    api.post<{ status: string; message: string }>(`/portfolios/${portfolioId}/regenerate_fitgap`, {
      vacancy_id: vacancyId
    }),

  exportPortfolio: async (portfolioId: number, format: "pdf" | "json", vacancyId?: number) => {
    const res = await api.get(`/portfolios/${portfolioId}/export`, {
      params: { format, ...(vacancyId ? { vacancy_id: vacancyId } : {}) },
      responseType: format === "pdf" ? "blob" : "json"
    });

    if (
      format === "pdf" &&
      res.data instanceof Blob &&
      !res.data.type.includes("application/pdf")
    ) {
      const text = await res.data.text();
      try {
        const err = JSON.parse(text);
        throw new Error(err.message || "Export failed");
      } catch (e) {
        if (e instanceof SyntaxError) {
          throw new Error("Export failed with an unexpected response", { cause: e });
        }
        throw e;
      }
    }

    return res;
  }
};
