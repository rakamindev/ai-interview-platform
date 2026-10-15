import { useCallback, useEffect, useRef, useState } from "react";
import { portfoliosApi } from "@/services/portfolios";
import { apiErrorMessage } from "@/services/api";
import type { FitGapReport } from "@/types";

export type FitGapState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "generating"; startedAt: number }
  | { status: "ready"; report: FitGapReport }
  | { status: "error"; message: string }
  | { status: "timeout" };

export const FITGAP_POLL_MS = 4000;
export const FITGAP_TIMEOUT_MS = 120_000;

function isNotFound(e: unknown) {
  return (e as { response?: { status?: number } })?.response?.status === 404;
}

/**
 * Loads a fit/gap report, asking the API to generate it at most once.
 *
 * The previous page re-sent the "generate" request on every 404 poll, which
 * enqueued a new job every five seconds and never gave up.
 */
export function useFitGapReport(portfolioId: number | null, vacancyId: number) {
  const [state, setState] = useState<FitGapState>({ status: "idle" });
  const startedAt = useRef<number>(0);

  const load = useCallback(async () => {
    if (portfolioId == null) return;
    setState({ status: "loading" });
    try {
      const res = await portfoliosApi.getFitGap(portfolioId, vacancyId);
      setState({ status: "ready", report: res.data.report });
      return;
    } catch (e) {
      if (!isNotFound(e)) {
        setState({ status: "error", message: apiErrorMessage(e, "The fit/gap report could not be loaded.") });
        return;
      }
    }

    try {
      const res = await portfoliosApi.triggerFitGap(portfolioId, vacancyId);
      if ("report" in res.data) {
        setState({ status: "ready", report: res.data.report });
      } else {
        startedAt.current = Date.now();
        setState({ status: "generating", startedAt: startedAt.current });
      }
    } catch (e) {
      setState({ status: "error", message: apiErrorMessage(e, "The fit/gap analysis could not be started.") });
    }
  }, [portfolioId, vacancyId]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll only while generating, and stop after the timeout.
  useEffect(() => {
    if (state.status !== "generating" || portfolioId == null) return;

    let cancelled = false;
    const id = setInterval(async () => {
      if (Date.now() - startedAt.current > FITGAP_TIMEOUT_MS) {
        clearInterval(id);
        if (!cancelled) setState({ status: "timeout" });
        return;
      }
      try {
        const res = await portfoliosApi.getFitGap(portfolioId, vacancyId);
        if (!cancelled) setState({ status: "ready", report: res.data.report });
      } catch (e) {
        if (!isNotFound(e) && !cancelled) {
          setState({ status: "error", message: apiErrorMessage(e, "The fit/gap report could not be loaded.") });
        }
      }
    }, FITGAP_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [state.status, portfolioId, vacancyId]);

  const regenerate = useCallback(async () => {
    if (portfolioId == null) return;
    try {
      await portfoliosApi.regenerateFitGap(portfolioId, vacancyId);
      startedAt.current = Date.now();
      setState({ status: "generating", startedAt: startedAt.current });
    } catch (e) {
      setState({ status: "error", message: apiErrorMessage(e, "The report could not be regenerated.") });
    }
  }, [portfolioId, vacancyId]);

  return { state, retry: load, regenerate };
}
