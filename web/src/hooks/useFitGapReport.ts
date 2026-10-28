import { useCallback, useEffect, useRef, useState } from "react";
import { portfoliosApi } from "@/services/portfolios";
import { apiErrorMessage } from "@/lib/apiError";
import { usePolling } from "./usePolling";
import type { FitGapReport } from "@/types";

type Phase = "loading" | "generating" | "ready" | "error";

const POLL_MS = 5000;

/**
 * Loads a fit/gap report and keeps it current. Generation is requested at most once per mount:
 * the API answers 202 while a run is in progress, so polling never needs to ask again (F7).
 */
export function useFitGapReport(portfolioId: number | null, vacancyId: number) {
  const [report, setReport] = useState<FitGapReport | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(false);

  const load = useCallback(async () => {
    if (portfolioId == null) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolioId, vacancyId);
      if (res.status === 202) {
        setPhase("generating");
        return;
      }
      setReport(res.data.report);
      setPhase(res.data.report.generating ? "generating" : "ready");
    } catch (e) {
      const status = (e as { response?: { status?: number } }).response?.status;
      if (status !== 404) {
        setError(apiErrorMessage(e));
        setPhase("error");
      } else if (requested.current) {
        // The run finished (lock released) without producing a report.
        setError("The report could not be generated. Try again.");
        setPhase("error");
      } else {
        requested.current = true;
        await portfoliosApi.triggerFitGap(portfolioId, vacancyId);
        setPhase("generating");
      }
    }
  }, [portfolioId, vacancyId]);

  useEffect(() => {
    load();
  }, [load]);

  usePolling(load, POLL_MS, phase === "generating");

  const regenerate = useCallback(async () => {
    if (portfolioId == null) return;
    try {
      await portfoliosApi.regenerateFitGap(portfolioId, vacancyId);
      setPhase("generating");
    } catch (e) {
      setError(apiErrorMessage(e));
      setPhase("error");
    }
  }, [portfolioId, vacancyId]);

  const retry = useCallback(() => {
    requested.current = false;
    setError(null);
    setPhase("loading");
    load();
  }, [load]);

  return { report, phase, error, regenerate, retry };
}
