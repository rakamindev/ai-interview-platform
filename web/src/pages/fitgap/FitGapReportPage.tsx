import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import LoadError from "@/components/LoadError";
import EmptyState from "@/components/EmptyState";
import Notice from "@/components/Notice";
import PageHeader from "@/components/layout/PageHeader";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import { LEVEL_LABELS, parseLevel } from "@/utils/constants";
import { downloadBlob } from "@/utils/download";
import { Download, Hourglass, Loader2, RefreshCw, Zap } from "lucide-react";
import type { FitGapReport, Portfolio } from "@/types";

// Reports normally finish within a few minutes; stop polling well past that so a stuck job is visible.
const GENERATION_TIMEOUT_MS = 10 * 60 * 1000;

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [generationTimedOut, setGenerationTimedOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [portfolioNotReady, setPortfolioNotReady] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const startGenerating = () => {
    setGenerating(true);
    setGenerationTimedOut(false);
    setGenerationStartedAt(Date.now());
  };

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    setReportError(null);
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
    } catch (requestError: unknown) {
      if (getApiErrorStatus(requestError) !== 404) {
        setReportError(getApiErrorMessage(requestError, "Failed to load the fit/gap report."));
        return;
      }
      try {
        const res = await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
        // The API returns an existing report directly instead of queueing a new one.
        if ("report" in res.data) {
          setReport(res.data.report);
          setGenerating(false);
        } else {
          setGenerating(true);
          setGenerationStartedAt((startedAt) => startedAt ?? Date.now());
        }
      } catch (triggerError: unknown) {
        setGenerating(false);
        setReportError(getApiErrorMessage(triggerError, "Failed to start the fit/gap analysis."));
      }
    }
  }, [portfolio, vacancyId]);

  const loadPortfolio = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then((res) => {
        const data = res.data;
        if ("portfolio" in data && data.portfolio.generation_status === "complete") {
          setPortfolio(data.portfolio);
          setPortfolioNotReady(false);
        } else {
          setPortfolioNotReady(true);
        }
      })
      .catch((requestError: unknown) =>
        setLoadError(getApiErrorMessage(requestError, "Failed to load the portfolio.")),
      )
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  useEffect(() => {
    if (portfolio) fetchReport();
  }, [portfolio, fetchReport]);

  const pollReport = useCallback(async () => {
    if (generationStartedAt && Date.now() - generationStartedAt > GENERATION_TIMEOUT_MS) {
      setGenerationTimedOut(true);
      return;
    }
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
    } catch {
      // Still generating (404) or a transient failure — try again on the next interval.
    }
  }, [portfolio, vacancyId, generationStartedAt]);

  usePolling(pollReport, 5000, generating && !generationTimedOut && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    setActionError(null);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      startGenerating();
    } catch (requestError: unknown) {
      setActionError(getApiErrorMessage(requestError, "Failed to regenerate the report."));
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setActionError(null);
    try {
      const res = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
      const blob =
        format === "pdf"
          ? new Blob([res.data as BlobPart], { type: "application/pdf" })
          : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      downloadBlob(blob, `fitgap-${sessionId}-${vacancyId}.${format}`);
    } catch (requestError: unknown) {
      setActionError(getApiErrorMessage(requestError, "Export failed. Please try again."));
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  const discoveredSkills = portfolio?.skills.filter((s) => s.is_discovered) ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        backTo={`/assessments/${id}/sessions/${sessionId}/portfolio`}
        backLabel="Back to portfolio"
        eyebrow="Assessment result"
        title="Fit/Gap Report"
        actions={
          portfolio && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={regenerating || generating}
              >
                {regenerating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Regenerate
              </Button>
              {report && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport("pdf")}
                    disabled={!!exporting}
                  >
                    {exporting === "pdf" ? <Loader2 className="animate-spin" /> : <Download />}
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport("json")}
                    disabled={!!exporting}
                  >
                    {exporting === "json" ? <Loader2 className="animate-spin" /> : <Download />}
                    JSON
                  </Button>
                </>
              )}
            </>
          )
        }
      />

      {loadError && <LoadError message={loadError} onRetry={loadPortfolio} />}

      {portfolioNotReady && (
        <EmptyState
          icon={Hourglass}
          title="Portfolio not ready"
          description="The portfolio isn't ready yet. Fit/gap analysis can run once portfolio generation has finished."
        />
      )}

      {reportError && <LoadError message={reportError} onRetry={fetchReport} />}
      {actionError && <Notice variant="error">{actionError}</Notice>}

      {generating && generationTimedOut && (
        <Notice
          variant="warning"
          action={
            <Button variant="outline" size="sm" onClick={startGenerating}>
              <RefreshCw /> Check again
            </Button>
          }
        >
          The fit/gap report is taking longer than expected. It may still finish, or the job may be
          stuck.
        </Notice>
      )}

      {/* Generating */}
      {generating && !generationTimedOut && (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rakamin-light-cyan">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </span>
          <p className="text-sm text-muted-foreground">Generating fit/gap report...</p>
        </Card>
      )}

      {/* Report ready */}
      {report && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Skill Comparison</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Culture &amp; Competency Fit</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {report.culture_narrative || report.overall_narrative}
              </p>
            </CardContent>
          </Card>

          {discoveredSkills.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-rakamin-dark-teal" />
                  Discovered Skills (not in vacancy requirements)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-5 pb-5">
                {discoveredSkills.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl bg-rakamin-light-cyan/40 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{s.skill_label}</span>
                    <span className="text-muted-foreground">
                      {LEVEL_LABELS[parseLevel(s.ai_level) ?? 0] ?? "Unrated"} (
                      {s.ai_confidence?.toLowerCase() === "low" ? "low confidence" : "confirmed"})
                    </span>
                    <span className="text-xs text-muted-foreground">
                      — Not required for this role, may be additive.
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
