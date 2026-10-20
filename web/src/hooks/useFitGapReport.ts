import { useCallback, useEffect, useRef, useState } from "react";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import type { FitGapReport } from "@/types";

export type FitGapLoadState = "loading" | "ready" | "not_ready" | "error";

export const NARRATIVE_POLL_MS = 4000;
/** ~2 minutes of waiting, then stop and let the person decide. */
export const NARRATIVE_MAX_POLLS = 30;

function statusOf(e: unknown): number | undefined {
  return (e as { response?: { status?: number } })?.response?.status;
}

/**
 * Loads the fit/gap report for one (portfolio, vacancy) pair.
 *
 * The comparison table arrives with the first response; only the AI narrative can still be
 * "pending". Polling is therefore limited to the narrative, is bounded, and a transient
 * network error while polling never wipes what is already on screen.
 */
export function useFitGapReport(portfolioId: number | undefined, vacancyId: number) {
  const [report, setReport] = useState<FitGapReport | null>(null);
  const [state, setState] = useState<FitGapLoadState>("loading");
  const [timedOut, setTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const polls = useRef(0);

  const load = useCallback(async () => {
    if (portfolioId == null) return;
    setState("loading");
    setTimedOut(false);
    polls.current = 0;
    try {
      let next: FitGapReport;
      try {
        next = (await portfoliosApi.getFitGap(portfolioId, vacancyId)).data.report;
      } catch (e) {
        if (statusOf(e) !== 404) throw e;
        next = (await portfoliosApi.triggerFitGap(portfolioId, vacancyId)).data.report;
      }
      setReport(next);
      setState("ready");
    } catch (e) {
      setState(statusOf(e) === 422 ? "not_ready" : "error");
    }
  }, [portfolioId, vacancyId]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    if (portfolioId == null) return;
    polls.current += 1;
    if (polls.current >= NARRATIVE_MAX_POLLS) setTimedOut(true);
    try {
      setReport((await portfoliosApi.getFitGap(portfolioId, vacancyId)).data.report);
    } catch {
      /* transient: keep what we have, the next tick retries */
    }
  }, [portfolioId, vacancyId]);

  usePolling(refresh, NARRATIVE_POLL_MS, report?.narrative_status === "pending" && !timedOut);

  /** Re-run the narrative only; the table stays visible throughout. Returns false on failure. */
  const regenerate = useCallback(async (): Promise<boolean> => {
    if (portfolioId == null) return false;
    setRetrying(true);
    try {
      const res = await portfoliosApi.regenerateFitGap(portfolioId, vacancyId);
      setReport(res.data.report);
      setTimedOut(false);
      polls.current = 0;
      return true;
    } catch {
      return false;
    } finally {
      setRetrying(false);
    }
  }, [portfolioId, vacancyId]);

  return { report, state, timedOut, retrying, reload: load, regenerate };
}
