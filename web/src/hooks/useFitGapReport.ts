import { useCallback, useEffect, useState } from "react";
import { usePolling } from "@/hooks/usePolling";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { classifyApiError, type ApiErrorInfo } from "@/utils/apiError";
import type { FitGapReport, Portfolio } from "@/types";

const POLL_INTERVAL_MS = 5000;

// Loads the portfolio and its fit/gap report. Polling only reads (GET) while
// the narrative is generating and stops on any final status or error; a
// narrative is only requested (POST) when the user asks for it.
export function useFitGapReport(sessionId: number, vacancyId: number) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [report, setReport] = useState<FitGapReport | null>(null);
  const [computedAt, setComputedAt] = useState<Date | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestFailed, setRequestFailed] = useState(false);
  const [pollFailed, setPollFailed] = useState(false);

  const applyReport = useCallback((next: FitGapReport) => {
    setReport(next);
    setComputedAt(new Date());
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await sessionsApi.getPortfolio(sessionId);
      const loaded = "portfolio" in res.data ? res.data.portfolio : null;
      if (!loaded) {
        setError({ kind: "portfolio_not_ready" });
        return;
      }
      setPortfolio(loaded);
      const fit = await portfoliosApi.getFitGap(loaded.id, vacancyId);
      applyReport(fit.data.report);
    } catch (e) {
      setError(classifyApiError(e));
    }
  }, [sessionId, vacancyId, applyReport]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // The candidate name is only shown in the header; the page works without it.
  const loadCandidate = useCallback(() => {
    sessionsApi
      .get(sessionId)
      .then((res) => setCandidateName(res.data.session.candidate_name ?? null))
      .catch(() => setCandidateName(null));
  }, [sessionId]);

  useEffect(loadCandidate, [loadCandidate]);

  const retry = useCallback(async () => {
    setRetrying(true);
    loadCandidate();
    await load();
    setRetrying(false);
  }, [load, loadCandidate]);

  const refresh = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, vacancyId);
      applyReport(res.data.report);
      setPollFailed(false);
    } catch {
      setPollFailed(true);
    }
  }, [portfolio, vacancyId, applyReport]);

  const generating = report?.narrative.status === "generating";
  usePolling(refresh, POLL_INTERVAL_MS, generating && !pollFailed);

  const requestNarrative = useCallback(async () => {
    if (!portfolio) return;
    setRequesting(true);
    setRequestFailed(false);
    try {
      const res = await portfoliosApi.triggerFitGap(portfolio.id, vacancyId);
      if ("report" in res.data) applyReport(res.data.report);
      else await refresh();
    } catch {
      setRequestFailed(true);
    } finally {
      setRequesting(false);
    }
  }, [portfolio, vacancyId, applyReport, refresh]);

  return {
    portfolio, report, computedAt, candidateName, loading, error, retry, retrying,
    requestNarrative, requesting, requestFailed, pollFailed, checkAgain: refresh,
  };
}
