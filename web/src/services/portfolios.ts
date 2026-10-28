import api from "./api";
import { apiErrorMessage } from "@/lib/apiError";
import type { AssessorOverride, FitGapReport } from "@/types";

export const portfoliosApi = {
  saveOverride: (portfolioSkillId: number, data: { override_level: number; assessor_notes: string }) =>
    api.post<{ override: AssessorOverride }>(`/portfolio_skills/${portfolioSkillId}/override`, {
      override: data,
    }),

  triggerFitGap: (portfolioId: number, vacancyId: number) =>
    api.post<{ report: FitGapReport } | { status: string; message: string }>(`/portfolios/${portfolioId}/fitgap`, {
      fitgap: { vacancy_id: vacancyId },
    }),

  /** 200 with the report, or 202 while the first report is still being generated. */
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
};

/**
 * Downloads a portfolio export as a file. Throws an Error with a readable message on failure;
 * for PDF requests the API's JSON error arrives as a Blob, so it is read back first.
 */
export async function downloadPortfolioExport(
  portfolioId: number,
  format: "pdf" | "json",
  filename: string,
  vacancyId?: number
) {
  try {
    const res = await portfoliosApi.exportPortfolio(portfolioId, format, vacancyId);
    const blob =
      format === "pdf"
        ? new Blob([res.data as BlobPart], { type: "application/pdf" })
        : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    const data = (e as { response?: { data?: unknown } }).response?.data;
    let body: unknown = data;
    if (data instanceof Blob) {
      try {
        body = JSON.parse(await data.text());
      } catch {
        body = null;
      }
    }
    throw new Error(apiErrorMessage({ response: { data: body } }, `Could not export the ${format.toUpperCase()}. Try again.`));
  }
}
