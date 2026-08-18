import type { Portfolio } from "@/types";

export type PortfolioViewStatus =
  | "generating"
  | "complete"
  | "failed"
  | "empty";

export interface PortfolioFetchPayload {
  status?: string;
  portfolio?: Portfolio | null;
  error?: string | null;
}

export interface NormalizedPortfolioView {
  status: PortfolioViewStatus;
  portfolio: Portfolio | null;
  /** Safe-ish message for assessors; may be empty when generating/complete */
  errorMessage: string | null;
}

/** Strip obvious secret-looking tokens from model/API error strings before UI display. */
export function sanitizeGenerationError(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let text = raw.trim();
  // Long token-like strings (API keys)
  text = text.replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, "[redacted]");
  text = text.replace(/\bsk-[0-9A-Za-z_-]{16,}\b/g, "[redacted]");
  text = text.replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [redacted]");
  return text;
}

/**
 * Normalize GET /sessions/:id/portfolio shapes:
 * - { status: "generating" } (HTTP 202)
 * - { portfolio, error? } with generation_status pending|generating|complete|failed
 */
export function normalizePortfolioResponse(data: PortfolioFetchPayload): NormalizedPortfolioView {
  const topStatus = data.status?.toLowerCase();
  if (topStatus === "generating" || topStatus === "pending") {
    return {
      status: "generating",
      portfolio: data.portfolio ?? null,
      errorMessage: null,
    };
  }

  const portfolio = data.portfolio ?? null;
  if (!portfolio) {
    return {
      status: "empty",
      portfolio: null,
      errorMessage: sanitizeGenerationError(data.error) ?? "No portfolio found for this session yet.",
    };
  }

  const gen = portfolio.generation_status;
  if (gen === "pending" || gen === "generating") {
    return { status: "generating", portfolio, errorMessage: null };
  }

  if (gen === "failed") {
    return {
      status: "failed",
      portfolio,
      errorMessage:
        sanitizeGenerationError(data.error) ||
        sanitizeGenerationError(portfolio.generation_error) ||
        "Portfolio generation failed. You can retry when the service is available.",
    };
  }

  if (gen === "complete") {
    return { status: "complete", portfolio, errorMessage: null };
  }

  return {
    status: "empty",
    portfolio,
    errorMessage: "Portfolio status is unknown. Refresh or retry generation.",
  };
}

/** Dangerous assessor actions stay off until generation is complete (or retryable). */
export function portfolioActionsAllowed(
  status: PortfolioViewStatus,
  portfolio: Portfolio | null = null
): { canExport: boolean; canRunFitGap: boolean; canRetry: boolean } {
  const ready = status === "complete" && portfolio != null;
  return {
    canExport: ready,
    canRunFitGap: ready,
    canRetry: status === "failed",
  };
}
