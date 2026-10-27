import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import LevelBadge from "@/components/portfolio/LevelBadge";
import { parseLevel } from "@/utils/constants";
import PageHeader from "@/components/layout/PageHeader";
import PageSkeleton, { PageHeaderSkeleton } from "@/components/layout/PageSkeleton";
import PageTransition from "@/components/layout/PageTransition";
import { Notice } from "@/components/motion/Notice";
import { AlertTriangle, Download, Loader2, RefreshCw } from "lucide-react";
import type { FitGapReport, Portfolio } from "@/types";
import ErrorState from "@/components/feedback/ErrorState";
import EmptyState from "@/components/feedback/EmptyState";

/** Stop polling after this long; the worker has most likely failed. */
const GENERATION_TIMEOUT_MS = 2 * 60 * 1000;

const PORTFOLIO_NOT_READY: Record<Exclude<Portfolio["generation_status"], "complete">, string> = {
  pending: "The candidate portfolio is queued. The fit/gap report becomes available once it is generated.",
  generating: "The candidate portfolio is still being generated. Check back in a minute.",
  failed: "Portfolio generation failed, so there is nothing to compare yet. Regenerate the portfolio first.",
};

/** True when an assessor adjusted a rating after this report was generated. */
export function isReportStale(report: Pick<FitGapReport, "generated_at">, overrides: Portfolio["overrides"]): boolean {
  const generatedAt = Date.parse(report.generated_at);
  if (Number.isNaN(generatedAt)) return false;
  return overrides.some((o) => o.overridden_at != null && Date.parse(o.overridden_at) > generatedAt);
}

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationStartedAt = useRef<number | null>(null);
  // Bumped on timeout / retry / regenerate so responses from older polls are ignored.
  const attempt = useRef(0);
  // Auto-queue generation at most once; after a timeout only an explicit retry re-queues.
  const autoTriggered = useRef(false);

  const portfolioReady = portfolio?.generation_status === "complete";

  const startGenerating = () => {
    attempt.current += 1;
    generationStartedAt.current = Date.now();
    setGenerating(true);
  };

  const fetchReport = useCallback(async () => {
    if (!portfolio || portfolio.generation_status !== "complete") return;

    const startedAt = generationStartedAt.current;
    if (startedAt && Date.now() - startedAt > GENERATION_TIMEOUT_MS) {
      attempt.current += 1;
      generationStartedAt.current = null;
      setGenerating(false);
      setError("The report is taking longer than expected. The background job may have failed. Try again.");
      return;
    }

    const myAttempt = attempt.current;
    const isStale = () => myAttempt !== attempt.current;

    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      if (isStale()) return;
      setReport(res.data.report);
      setGenerating(false);
      generationStartedAt.current = null;
      setError(null);
    } catch (e: any) {
      if (isStale()) return;
      if (e?.response?.status !== 404) {
        setGenerating(false);
        setError("Could not load the fit/gap report. Check your connection and try again.");
        return;
      }
      // Not generated yet: queue it once, then keep polling.
      if (autoTriggered.current) return;
      autoTriggered.current = true;
      try {
        await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
        if (isStale()) return;
        generationStartedAt.current = Date.now();
        setGenerating(true);
      } catch {
        if (isStale()) return;
        setGenerating(false);
        setError("Could not start generating the fit/gap report. Try again.");
      }
    }
  }, [portfolio, vacancyId]);

  useEffect(() => {
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then(async (res) => {
        const data = res.data as any;
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        }
      })
      .catch(() => setError("Could not load the candidate portfolio. Check your connection and reload the page."))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (portfolio) fetchReport();
  }, [portfolio, fetchReport]);

  usePolling(fetchReport, 5000, generating && portfolioReady);

  const handleRetry = () => {
    attempt.current += 1;
    autoTriggered.current = false;
    setError(null);
    generationStartedAt.current = null;
    fetchReport();
  };

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    setError(null);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      startGenerating();
    } catch {
      setError("Could not queue a new report. Your current report is unchanged.");
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
      const ext = format;
      const blob = format === "pdf"
        ? new Blob([res.data as BlobPart], { type: "application/pdf" })
        : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitgap-${sessionId}-${vacancyId}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <PageSkeleton label="fit/gap report">
        <PageHeaderSkeleton subtitle={false} actions={3} />
        <Card>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-6 w-28" />)}
            </div>
            <div className="divide-y rounded-lg border">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </CardContent>
        </Card>
      </PageSkeleton>
    );
  }

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <PageHeader
        backTo={`/assessments/${id}/sessions/${sessionId}/portfolio`}
        backLabel="Candidate Portfolio"
        title="Fit/gap report"
      >
        {portfolioReady && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || generating}>
              {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Regenerate
            </Button>
            {report && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting}>
                  {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!!exporting}>
                  {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                  JSON
                </Button>
              </>
            )}
          </div>
        )}
      </PageHeader>

      {/* Error */}
      <Notice show={!!error}>
        <ErrorState message={error} onRetry={portfolioReady ? handleRetry : undefined} />
      </Notice>

      {/* No portfolio / portfolio not ready */}
      {!error && !portfolioReady && (
        <EmptyState
          title="Fit/gap report not available yet"
          description={
            portfolio && portfolio.generation_status !== "complete"
              ? PORTFOLIO_NOT_READY[portfolio.generation_status]
              : "This session has no portfolio. A portfolio is created when the interview ends."
          }
          action={
            <Button asChild variant="outline" size="sm">
              <Link to={`/assessments/${id}/sessions/${sessionId}/portfolio`}>Back to portfolio</Link>
            </Button>
          }
        />
      )}

      {/* Generating */}
      {generating && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Generating fit/gap report…</p>
          <p className="text-xs text-muted-foreground">This usually takes under a minute.</p>
        </div>
      )}

      {/* Report ready */}
      {report && (
        <>
          <Notice show={!!portfolio && isReportStale(report, portfolio.overrides)}>
            <div role="status" className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <AlertTriangle className="hidden sm:block h-4 w-4 shrink-0 text-amber-700" aria-hidden />
              <p className="flex-1 text-sm text-amber-900">
                A rating was overridden after this report was generated, so the comparison below uses the old level.
                Regenerate to include the change.
              </p>
              <Button size="sm" onClick={handleRegenerate} disabled={regenerating} className="min-h-11 sm:min-h-9">
                {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Regenerate report
              </Button>
            </div>
          </Notice>

          {/* Skill comparison */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Skill Comparison</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          <Separator />

          {/* Culture & competency */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Culture &amp; Competency Fit</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {report.culture_narrative || report.overall_narrative || (
                  <span className="text-muted-foreground italic">No narrative was generated for this report.</span>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Discovered skills */}
          {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
            <>
              <Separator />
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Skills found outside this vacancy</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    The interview surfaced these, but the vacancy does not require them. They can add value; they do not change the comparison.
                  </p>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <ul className="divide-y">
                    {portfolio.skills
                      .filter((s) => s.is_discovered)
                      .map((s) => (
                        <li key={s.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                          <LevelBadge level={parseLevel(s.ai_level)} size="sm" />
                          <span className="text-sm font-medium min-w-0 break-words flex-1">{s.skill_label}</span>
                          {s.ai_confidence?.toLowerCase() === "low" && (
                            <span className="text-xs text-muted-foreground shrink-0">Low confidence</span>
                          )}
                        </li>
                      ))}
                  </ul>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </PageTransition>
  );
}
