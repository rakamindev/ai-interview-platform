import axios from "axios";

import api from "@/services/api";
import type { Portfolio, Session, Vacancy } from "@/types";

import type {
  FitGapContext,
  FitGapExportFormat,
  FitGapReport,
} from "../types/fit-gap.types";

interface PortfolioResponse {
  portfolio?: Portfolio;
  status?: string;
}

interface SessionResponse {
  session: Session;
}

interface VacancyResponse {
  vacancy: Vacancy;
}

interface ReportResponse {
  report: FitGapReport;
}

interface GenerationResponse {
  report?: FitGapReport;
  status?: string;
  message?: string;
}

export class PortfolioNotReadyError extends Error {
  constructor() {
    super("The candidate portfolio is not ready for comparison.");
    this.name = "PortfolioNotReadyError";
  }
}

export const fitGapApi = {
  async getContext(
    sessionId: number,
    vacancyId: number,
    signal?: AbortSignal,
  ): Promise<FitGapContext> {
    const [portfolioResponse, sessionResponse, vacancyResponse] = await Promise.all([
      api.get<PortfolioResponse>(`/sessions/${sessionId}/portfolio`, { signal }),
      api.get<SessionResponse>(`/sessions/${sessionId}`, { signal }),
      api.get<VacancyResponse>(`/vacancies/${vacancyId}`, { signal }),
    ]);

    if (
      !portfolioResponse.data.portfolio ||
      portfolioResponse.data.portfolio.generation_status !== "complete"
    ) {
      throw new PortfolioNotReadyError();
    }

    return {
      portfolio: portfolioResponse.data.portfolio,
      vacancy: vacancyResponse.data.vacancy,
      candidateName: sessionResponse.data.session.candidate_name ?? null,
    };
  },

  async ensureReport(
    portfolioId: number,
    vacancyId: number,
    signal?: AbortSignal,
  ): Promise<FitGapReport | null> {
    try {
      const response = await api.get<ReportResponse>(
        `/portfolios/${portfolioId}/fitgap/${vacancyId}`,
        { signal },
      );
      return response.data.report;
    } catch (error: unknown) {
      if (!axios.isAxiosError(error) || error.response?.status !== 404) throw error;

      const response = await api.post<GenerationResponse>(
        `/portfolios/${portfolioId}/fitgap`,
        { fitgap: { vacancy_id: vacancyId } },
        { signal },
      );
      return response.data.report ?? null;
    }
  },

  regenerate(portfolioId: number, vacancyId: number) {
    return api.post<GenerationResponse>(`/portfolios/${portfolioId}/regenerate_fitgap`, {
      vacancy_id: vacancyId,
    });
  },

  exportReport(portfolioId: number, vacancyId: number, format: FitGapExportFormat) {
    return api.get(`/portfolios/${portfolioId}/export`, {
      params: { format, vacancy_id: vacancyId },
      responseType: format === "pdf" ? "blob" : "json",
    });
  },
};
