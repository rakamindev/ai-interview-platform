import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import {
  MAX_FETCH_FAILURES,
  canRetry,
  derivePortfolioState,
  isInProgress,
  retryErrorMessage,
  type PortfolioResponseBody,
  type PortfolioViewState,
} from "@/utils/portfolioState";
import axios from "axios";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, FileText } from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [viewState, setViewState] = useState<PortfolioViewState>({ kind: "generating" });
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const failuresRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);

  const fetchPortfolio = useCallback(
    async (initial = false) => {
      try {
        const res = await sessionsApi.getPortfolio(Number(sessionId));
        failuresRef.current = 0;
        const data = res.data as PortfolioResponseBody & { portfolio?: Portfolio };
        const next = derivePortfolioState(data, Date.now());
        setViewState(next);
        if (next.kind === "complete" && data.portfolio) {
          setPortfolio(data.portfolio);
          // Build overrides map
          const overrideMap: Record<number, AssessorOverride> = {};
          data.portfolio.overrides.forEach((o: AssessorOverride) => {
            overrideMap[o.portfolio_skill_id] = o;
          });
          setOverrides(overrideMap);
        }
      } catch {
        // A first failure means we know nothing yet; later ones may be a blip.
        failuresRef.current += 1;
        if (initial || failuresRef.current >= MAX_FETCH_FAILURES) {
          setViewState({ kind: "unreachable" });
        }
      }
    },
    [sessionId]
  );

  useEffect(() => {
    Promise.all([fetchPortfolio(true), vacanciesApi.list(), sessionsApi.get(Number(sessionId))])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data.vacancies);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  // Poll only while a job may still finish; the API reports stale/failed when it cannot.
  usePolling(() => fetchPortfolio(), 5000, isInProgress(viewState));

  const handleRetry = async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      await sessionsApi.regeneratePortfolio(Number(sessionId));
      failuresRef.current = 0;
      setViewState({ kind: "generating" });
    } catch (err) {
      setRetryError(retryErrorMessage(axios.isAxiosError(err) ? err.response?.status : undefined));
    } finally {
      setRetrying(false);
    }
  };

  const handleCheckAgain = () => {
    failuresRef.current = 0;
    setViewState({ kind: "generating" });
    fetchPortfolio(true);
  };

  const handleOverrideSaved = (skillId: number, override: AssessorOverride) => {
    setOverrides((prev) => ({ ...prev, [skillId]: override }));
  };

  const handleRunFitGap = () => {
    if (!selectedVacancy || !portfolio) return;
    navigate(`/assessments/${id}/sessions/${sessionId}/fitgap/${selectedVacancy}`);
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setExportError(null);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        selectedVacancy ? Number(selectedVacancy) : undefined
      );
      if (format === "json") {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-${sessionId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-${sessionId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      setExportError(`Could not export the ${format.toUpperCase()}. Please try again.`);
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Link to={`/assessments/${id}/invite`} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Portfolio Results</h1>
            {candidateName && (
              <p className="text-sm text-muted-foreground">{candidateName}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex items-center gap-1 text-sm border rounded-md px-3 py-1.5 hover:bg-accent transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Transcript
          </Link>
          {viewState.kind === "complete" && portfolio && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
              >
                {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
                disabled={!!exporting}
              >
                {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {exportError && (
        <p role="alert" className="text-sm text-destructive">
          {exportError}
        </p>
      )}

      {/* Generating state */}
      {(viewState.kind === "generating" || viewState.kind === "slow") && (
        <div className="border rounded-lg p-12 text-center space-y-3" role="status" aria-live="polite">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <div>
            <p className="font-medium">Generating portfolio...</p>
            <p className="text-sm text-muted-foreground mt-1">
              {viewState.kind === "slow"
                ? "This is taking longer than usual. The AI may be busy. You can keep waiting or come back later."
                : "The AI is analyzing the interview transcript. This takes about 2 minutes."}
            </p>
          </div>
        </div>
      )}

      {/* Stalled or failed state */}
      {(viewState.kind === "stale" || viewState.kind === "failed") && (
        <div className="border border-destructive/40 rounded-lg p-6 text-center space-y-3" role="alert">
          <p className="font-medium text-destructive">
            {viewState.kind === "stale" ? "Portfolio generation seems to have stalled." : "Portfolio generation failed."}
          </p>
          <p className="text-sm text-muted-foreground">
            {viewState.kind === "stale"
              ? "There has been no progress for over 10 minutes. The interview is saved, so you can generate the portfolio again."
              : "The interview is saved, so you can generate the portfolio again."}
          </p>
          {viewState.kind === "failed" && viewState.reason && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Technical details</summary>
              <p className="mt-1 break-words">{viewState.reason}</p>
            </details>
          )}
          {retryError && <p className="text-sm text-destructive">{retryError}</p>}
          {canRetry(viewState) && (
            <Button variant="outline" size="sm" onClick={handleRetry} disabled={retrying}>
              {retrying ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Try again
            </Button>
          )}
        </div>
      )}

      {/* Server unreachable state */}
      {viewState.kind === "unreachable" && (
        <div className="border border-destructive/40 rounded-lg p-6 text-center space-y-3" role="alert">
          <p className="font-medium text-destructive">Could not reach the server.</p>
          <p className="text-sm text-muted-foreground">Check your connection, then try loading the portfolio again.</p>
          <Button variant="outline" size="sm" onClick={handleCheckAgain}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Check again
          </Button>
        </div>
      )}

      {/* Ready state */}
      {viewState.kind === "complete" && portfolio && (
        <>
          {/* Configured skills */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Configured Skills</h2>
            {portfolio.skills
              .filter((s) => !s.is_discovered)
              .map((skill) => (
                <SkillPortfolioCard
                  key={skill.id}
                  skill={skill}
                  override={overrides[skill.id]}
                  onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                />
              ))}
          </div>

          {/* Discovered skills */}
          {portfolio.skills.some((s) => s.is_discovered) && (
            <>
              <Separator />
              <div className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Discovered Skills
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Skills the AI probed that were not in the original assessment
                  </p>
                </div>
                {portfolio.skills
                  .filter((s) => s.is_discovered)
                  .map((skill) => (
                    <SkillPortfolioCard
                      key={skill.id}
                      skill={skill}
                      override={overrides[skill.id]}
                      onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                    />
                  ))}
              </div>
            </>
          )}

          <Separator />

          {/* Fit/Gap */}
          <div className="flex items-center gap-3">
            <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Choose vacancy..." />
              </SelectTrigger>
              <SelectContent>
                {vacancies.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.role_title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleRunFitGap} disabled={!selectedVacancy}>
              Run Fit/Gap Analysis →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
