import { useCallback, useEffect, useRef, useState } from "react";
import { portfoliosApi } from "@/services/portfolios";
import type { FitGapReport } from "@/types";

/**
 * Lifecycle of the fit/gap screen. Every state has a visible UI and a next
 * action — there is no state in which the page can spin forever.
 *
 *   idle → loading → generating → ready
 *                              ↘ failed   (server marked the run failed; retry)
 *                              ↘ timeout  (still running after POLL_DEADLINE_MS; check again)
 *          loading → not_ready             (portfolio not complete yet)
 *          loading → error                 (network / unexpected API error; retry)
 */
export type FitGapPhase = "idle" | "loading" | "generating" | "ready" | "failed" | "timeout" | "not_ready" | "error";

export const POLL_DELAYS_MS = [2000, 3000, 5000, 8000, 10000];
export const POLL_DEADLINE_MS = 120_000;

interface State {
  phase: FitGapPhase;
  report: FitGapReport | null;
  error: string | null;
}

function phaseFor(report: FitGapReport): FitGapPhase {
  if (report.status === "complete") return "ready";
  if (report.status === "failed") return "failed";
  return "generating";
}

function apiMessage(error: unknown): string {
  const e = error as { response?: { data?: { errors?: { message?: string }[] } } };
  return e?.response?.data?.errors?.[0]?.message ?? "We couldn't reach the server. Check your connection and try again.";
}

function apiStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

export function useFitGapReport(portfolioId: number | null, vacancyId: number) {
  const [state, setState] = useState<State>({ phase: "idle", report: null, error: null });
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const run = useRef(0); // invalidates in-flight polls after unmount / restart

  const stopPolling = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = undefined;
  };

  const poll = useCallback(
    (runId: number, attempt: number, startedAt: number) => {
      const delay = POLL_DELAYS_MS[Math.min(attempt, POLL_DELAYS_MS.length - 1)];
      timer.current = setTimeout(async () => {
        if (run.current !== runId || portfolioId == null) return;
        try {
          const { data } = await portfoliosApi.getFitGap(portfolioId, vacancyId);
          if (run.current !== runId) return;
          const phase = phaseFor(data.report);
          if (phase === "generating" && Date.now() - startedAt >= POLL_DEADLINE_MS) {
            setState({ phase: "timeout", report: data.report, error: null });
            return;
          }
          setState({ phase, report: data.report, error: null });
          if (phase === "generating") poll(runId, attempt + 1, startedAt);
        } catch {
          // A transient poll failure is not fatal: keep showing what we have.
          if (run.current !== runId) return;
          if (Date.now() - startedAt >= POLL_DEADLINE_MS) {
            setState((s) => ({ ...s, phase: "timeout" }));
          } else {
            poll(runId, attempt + 1, startedAt);
          }
        }
      }, delay);
    },
    [portfolioId, vacancyId]
  );

  const start = useCallback(
    async (request: () => Promise<{ data: { report: FitGapReport } }>) => {
      stopPolling();
      const runId = ++run.current;
      setState((s) => ({ ...s, phase: s.report ? "generating" : "loading", error: null }));
      try {
        const { data } = await request();
        if (run.current !== runId) return;
        const phase = phaseFor(data.report);
        setState({ phase, report: data.report, error: null });
        if (phase === "generating") poll(runId, 0, Date.now());
      } catch (error) {
        if (run.current !== runId) return;
        const status = apiStatus(error);
        setState((s) => ({
          ...s,
          phase: status === 422 && !s.report ? "not_ready" : "error",
          error: apiMessage(error),
        }));
      }
    },
    [poll]
  );

  useEffect(() => {
    if (portfolioId == null) return;
    start(() => portfoliosApi.ensureFitGap(portfolioId, vacancyId));
    return () => {
      run.current++;
      stopPolling();
    };
  }, [portfolioId, vacancyId, start]);

  const regenerate = useCallback(() => {
    if (portfolioId == null) return;
    start(() => portfoliosApi.regenerateFitGap(portfolioId, vacancyId));
  }, [portfolioId, vacancyId, start]);

  const checkAgain = useCallback(() => {
    if (portfolioId == null) return;
    start(() => portfoliosApi.ensureFitGap(portfolioId, vacancyId));
  }, [portfolioId, vacancyId, start]);

  return { ...state, regenerate, checkAgain };
}
