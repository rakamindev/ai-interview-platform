import { useCallback, useEffect, useRef, useState } from "react";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import type { FitGapReport, Portfolio } from "@/types";

export const POLL_INTERVAL_MS = 3000;
export const MAX_WAIT_MS = 90_000;
export const MAX_CONSECUTIVE_ERRORS = 3;

export type FitGapPhase =
  | "loading"             // fetching the portfolio / asking for the report
  | "portfolio_not_ready" // the portfolio is still generating or failed
  | "generating"          // the report is being computed (a previous one may still be shown)
  | "ready"
  | "slow"                // still not ready after MAX_WAIT_MS; the user can check again
  | "error";              // the API could not be reached

interface State {
  phase: FitGapPhase;
  portfolio: Portfolio | null;
  report: FitGapReport | null;
}

const isNotFound = (e: unknown) => (e as { response?: { status?: number } })?.response?.status === 404;

/**
 * Owns the whole request -> poll -> done cycle for one fit/gap report.
 *
 * POST /fitgap is asked once per run: it returns the report when it is current,
 * or queues a computation. Only GET is polled, so polling never queues more jobs.
 * Each run has an id; responses that arrive after a newer run started are dropped.
 */
export function useFitGapReport(sessionId: number, vacancyId: number) {
  const [state, setState] = useState<State>({ phase: "loading", portfolio: null, report: null });
  const runId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const portfolioRef = useRef<Portfolio | null>(null);

  const cancel = () => {
    runId.current += 1;
    clearTimeout(timer.current);
  };

  const poll = useCallback(
    (id: number, portfolioId: number, startedAt: number, errors: number) => {
      timer.current = setTimeout(async () => {
        try {
          const res = await portfoliosApi.getFitGap(portfolioId, vacancyId);
          if (id !== runId.current) return;
          setState((s) => ({ ...s, phase: "ready", report: res.data.report }));
        } catch (e) {
          if (id !== runId.current) return;
          const nextErrors = isNotFound(e) ? 0 : errors + 1;
          if (nextErrors >= MAX_CONSECUTIVE_ERRORS) {
            setState((s) => ({ ...s, phase: "error" }));
          } else if (Date.now() - startedAt >= MAX_WAIT_MS) {
            setState((s) => ({ ...s, phase: "slow" }));
          } else {
            poll(id, portfolioId, startedAt, nextErrors);
          }
        }
      }, POLL_INTERVAL_MS);
    },
    [vacancyId],
  );

  const start = useCallback(
    async (mode: "request" | "regenerate") => {
      cancel();
      const id = runId.current;
      setState((s) => ({ ...s, phase: s.report ? "generating" : "loading" }));

      try {
        let portfolio = portfolioRef.current;
        if (!portfolio) {
          const res = await sessionsApi.getPortfolio(sessionId);
          if (id !== runId.current) return;
          const loaded = (res.data as { portfolio?: Portfolio }).portfolio;
          if (!loaded || loaded.generation_status !== "complete") {
            setState((s) => ({ ...s, phase: "portfolio_not_ready", portfolio: loaded ?? null }));
            return;
          }
          portfolio = portfolioRef.current = loaded;
          setState((s) => ({ ...s, portfolio: loaded }));
        }

        if (mode === "regenerate") {
          await portfoliosApi.regenerateFitGap(portfolio.id, vacancyId);
        } else {
          const res = await portfoliosApi.triggerFitGap(portfolio.id, vacancyId);
          if (id !== runId.current) return;
          if ("report" in res.data) {
            const report = res.data.report;
            setState((s) => ({ ...s, phase: "ready", report }));
            return;
          }
        }

        if (id !== runId.current) return;
        setState((s) => ({ ...s, phase: "generating" }));
        poll(id, portfolio.id, Date.now(), 0);
      } catch {
        if (id === runId.current) setState((s) => ({ ...s, phase: "error" }));
      }
    },
    [sessionId, vacancyId, poll],
  );

  useEffect(() => {
    portfolioRef.current = null;
    setState({ phase: "loading", portfolio: null, report: null });
    start("request");
    return cancel;
  }, [start]);

  return {
    ...state,
    /** A computation is running while a previous report stays on screen. */
    updating: state.phase === "generating" && state.report !== null,
    regenerate: useCallback(() => start("regenerate"), [start]),
    retry: useCallback(() => start("request"), [start]),
  };
}
