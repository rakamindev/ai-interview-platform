import type { Portfolio } from "@/types";

/** How long we wait before telling the assessor generation is slower than usual. */
export const SLOW_AFTER_MS = 2 * 60 * 1000;

/** Consecutive failed requests after which we stop polling and say so. */
export const MAX_FETCH_FAILURES = 3;

export type PortfolioViewState =
  | { kind: "generating" }
  | { kind: "slow" }
  | { kind: "stale" }
  | { kind: "failed"; reason?: string }
  | { kind: "complete" }
  | { kind: "unreachable" };

/** Shape of GET /sessions/:id/portfolio, for every status the API can answer with. */
export interface PortfolioResponseBody {
  status?: string;
  stale?: boolean;
  error?: string;
  portfolio?: Partial<Pick<Portfolio, "generation_status" | "generation_error" | "status_changed_at">> | null;
}

/** Milliseconds the portfolio has been in its current status (0 when unknown). */
export function waitedMs(body: PortfolioResponseBody, nowMs: number): number {
  const changedAt = body.portfolio?.status_changed_at;
  if (!changedAt) return 0;
  const parsed = Date.parse(changedAt);
  return Number.isNaN(parsed) ? 0 : Math.max(0, nowMs - parsed);
}

/** Single source of truth for what the portfolio page should show. */
export function derivePortfolioState(body: PortfolioResponseBody, nowMs: number): PortfolioViewState {
  const portfolio = body.portfolio;

  if (portfolio?.generation_status === "complete") return { kind: "complete" };

  if (portfolio?.generation_status === "failed") {
    return { kind: "failed", reason: portfolio.generation_error ?? body.error ?? undefined };
  }

  if (body.stale || body.status === "stale") return { kind: "stale" };

  return waitedMs(body, nowMs) >= SLOW_AFTER_MS ? { kind: "slow" } : { kind: "generating" };
}

/** Polling only makes sense while a job may still finish. */
export const isInProgress = (state: PortfolioViewState): boolean =>
  state.kind === "generating" || state.kind === "slow";

/** The backend only accepts a retry for failed or stale portfolios. */
export const canRetry = (state: PortfolioViewState): boolean =>
  state.kind === "failed" || state.kind === "stale";

/** What to tell the assessor when "Try again" is refused or fails. */
export function retryErrorMessage(httpStatus?: number): string {
  if (httpStatus === 409) return "This portfolio is already being generated. Please wait a moment.";
  if (httpStatus === 503) return "The generation queue is unavailable right now. Please try again shortly.";
  return "Could not restart generation. Please try again.";
}
