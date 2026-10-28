import { useCallback, useEffect, useState } from "react";
import { usePolling } from "@/hooks/usePolling";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { classifyApiError, type ApiErrorInfo } from "@/utils/apiError";
import type { Portfolio, Vacancy } from "@/types";

const POLL_INTERVAL_MS = 5000;

function isGenerating(portfolio: Portfolio | null): boolean {
  return portfolio?.generation_status === "pending" || portfolio?.generation_status === "generating";
}

// Loads a session's portfolio for review. Polling only reads (GET) while
// the portfolio is being generated; regeneration is only requested when
// the assessor presses Retry.
export function usePortfolioReview(sessionId: number) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateFailed, setRegenerateFailed] = useState(false);
  const [pollFailed, setPollFailed] = useState(false);
  // While generating, the API answers 202 { status: "generating" } without a portfolio.
  const [awaitingPortfolio, setAwaitingPortfolio] = useState(false);

  const fetchPortfolio = useCallback(async () => {
    const res = await sessionsApi.getPortfolio(sessionId);
    if ("portfolio" in res.data && res.data.portfolio) {
      setPortfolio(res.data.portfolio);
      setAwaitingPortfolio(false);
    } else {
      setAwaitingPortfolio(true);
    }
  }, [sessionId]);

  const load = useCallback(async () => {
    setError(null);
    try {
      await fetchPortfolio();
    } catch (e) {
      setError(classifyApiError(e));
    }
  }, [fetchPortfolio]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // Header and vacancy picker only; the page works without them.
  useEffect(() => {
    sessionsApi.get(sessionId)
      .then((res) => setCandidateName(res.data.session.candidate_name ?? null))
      .catch(() => setCandidateName(null));
    vacanciesApi.list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setVacancies([]));
  }, [sessionId]);

  const retry = useCallback(async () => {
    setRetrying(true);
    await load();
    setRetrying(false);
  }, [load]);

  // Reloads after a review action or a conflict, without the loading state,
  // so open dialogs keep what the assessor typed.
  const refresh = useCallback(async () => {
    try {
      await fetchPortfolio();
      setPollFailed(false);
    } catch {
      setPollFailed(true);
    }
  }, [fetchPortfolio]);

  const generating = awaitingPortfolio || isGenerating(portfolio);
  usePolling(refresh, POLL_INTERVAL_MS, generating && !pollFailed);

  const regenerate = useCallback(async () => {
    setRegenerating(true);
    setRegenerateFailed(false);
    try {
      await sessionsApi.regeneratePortfolio(sessionId);
      setAwaitingPortfolio(true);
      setPortfolio((current) => (current ? { ...current, generation_status: "generating" } : current));
    } catch {
      setRegenerateFailed(true);
    } finally {
      setRegenerating(false);
    }
  }, [sessionId]);

  return {
    portfolio, candidateName, vacancies, loading, error, retry, retrying, refresh, pollFailed,
    regenerate, regenerating, regenerateFailed, generating,
  };
}
