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
import { LEVEL_LABELS } from "@/utils/constants";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap } from "lucide-react";
import type { FitGapReport, Portfolio } from "@/types";

const REPORT_POLL_TIMEOUT_MS = 5 * 60 * 1000;

function apiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== "object" || error === null || !("response" in error)) return fallback;

  const response = (error as {
    response?: {
      data?: {
        message?: string;
        errors?: Array<{ message?: string }>;
      };
    };
  }).response;

  return response?.data?.errors?.[0]?.message ?? response?.data?.message ?? fallback;
}

function apiStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("response" in error)) return undefined;
  return (error as { response?: { status?: number } }).response?.status;
}

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [portfolioGenerating, setPortfolioGenerating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reportRequested = useRef(false);
  const requestStartedAt = useRef<number | null>(null);
  const requestInFlight = useRef(false);

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await sessionsApi.getPortfolio(Number(sessionId));
      const data = res.data;

      if ("portfolio" in data && data.portfolio) {
        setPortfolio(data.portfolio);
        const status = data.portfolio.generation_status;
        setPortfolioGenerating(status === "pending" || status === "generating");
        if (status === "complete") setError(null);
        if (status === "failed") {
          setError("Portfolio generation failed. Return to the portfolio page to retry it.");
        }
      } else if ("status" in data) {
        setPortfolioGenerating(data.status === "generating");
      } else {
        setPortfolioGenerating(false);
      }
    } catch (requestError) {
      setPortfolioGenerating(false);
      setError(apiErrorMessage(requestError, "Could not load this candidate portfolio."));
    }
  }, [sessionId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchPortfolio().finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [fetchPortfolio]);

  usePolling(fetchPortfolio, 5000, portfolioGenerating);

  const fetchReport = useCallback(async () => {
    if (!portfolio || portfolio.generation_status !== "complete" || requestInFlight.current) return;
    requestInFlight.current = true;

    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      const nextReport = res.data.report;
      setReport(nextReport);

      if (nextReport.generation_status === "complete") {
        setGenerating(false);
        setError(null);
      } else if (nextReport.generation_status === "failed") {
        setGenerating(false);
        setError("Report generation failed. Retry to generate a fresh comparison.");
      } else {
        requestStartedAt.current ??= Date.now();
        if (Date.now() - requestStartedAt.current >= REPORT_POLL_TIMEOUT_MS) {
          setGenerating(false);
          setError("Report generation is taking longer than expected. You can retry without losing the last completed report.");
        } else {
          setGenerating(true);
          setError(null);
        }
      }
    } catch (requestError) {
      if (apiStatus(requestError) === 404 && !reportRequested.current) {
        reportRequested.current = true;
        requestStartedAt.current = Date.now();
        try {
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          setGenerating(true);
          setError(null);
        } catch (queueError) {
          reportRequested.current = false;
          setGenerating(false);
          setError(apiErrorMessage(queueError, "Could not start fit/gap report generation."));
        }
      } else if (
        reportRequested.current &&
        requestStartedAt.current !== null &&
        Date.now() - requestStartedAt.current >= REPORT_POLL_TIMEOUT_MS
      ) {
        setGenerating(false);
        setError("Report generation is taking longer than expected. You can retry without losing the last completed report.");
      } else if (apiStatus(requestError) !== 404) {
        setGenerating(false);
        setError(apiErrorMessage(requestError, "Could not load the fit/gap report."));
      } else {
        setGenerating(true);
      }
    } finally {
      requestInFlight.current = false;
    }
  }, [portfolio, vacancyId]);

  useEffect(() => {
    reportRequested.current = false;
    requestStartedAt.current = null;
    setReport(null);
    setError(null);
    setGenerating(false);

    if (portfolio?.generation_status === "complete") void fetchReport();
  }, [portfolio?.id, vacancyId, fetchReport]);

  usePolling(fetchReport, 5000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    reportRequested.current = true;
    requestStartedAt.current = Date.now();
    setError(null);
    setGenerating(true);

    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
    } catch (requestError) {
      setGenerating(false);
      setError(apiErrorMessage(requestError, "Could not regenerate the fit/gap report."));
    } finally {
      setRegenerating(false);
    }
  };

  const handleRetry = async () => {
    if (!portfolio) {
      await fetchPortfolio();
      return;
    }

    if (report && report.generation_status !== "complete") {
      await handleRegenerate();
      return;
    }

    reportRequested.current = false;
    requestStartedAt.current = null;
    setError(null);
    await fetchReport();
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setError(null);
    try {
      const res = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
      const blob = format === "pdf"
        ? new Blob([res.data as BlobPart], { type: "application/pdf" })
        : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitgap-${sessionId}-${vacancyId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, `Could not export the ${format.toUpperCase()} report.`));
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Back to portfolio"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-semibold">Fit/Gap Report</h1>
          </div>
        </div>

        {portfolio?.generation_status === "complete" && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || generating}>
              {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Regenerate
            </Button>
            {report?.generation_status === "complete" && (
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
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive break-words">{error}</p>
          {portfolio?.generation_status === "failed" ? (
            <Button asChild variant="outline" size="sm">
              <Link to={`/assessments/${id}/sessions/${sessionId}/portfolio`}>
                Return to portfolio
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleRetry} disabled={regenerating}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Retry
            </Button>
          )}
        </div>
      )}

      {portfolioGenerating && (
        <div role="status" className="space-y-3 rounded-lg border p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">The portfolio is still being generated. This report will be available when it is complete.</p>
        </div>
      )}

      {generating && (
        <div role="status" className="space-y-3 rounded-lg border p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {report?.generated_at ? "Updating the report. The last completed comparison remains visible below." : "Generating fit/gap report..."}
          </p>
        </div>
      )}

      {report?.generated_at && (
        <>
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
              <CardTitle className="text-sm">Skill Comparison</CardTitle>
              {report.generated_at && (
                <p className="text-xs text-muted-foreground">
                  Last completed {new Date(report.generated_at).toLocaleString()}
                </p>
              )}
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Culture &amp; Competency Fit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <p className="text-xs text-muted-foreground">
                This report supports human review; it is not an automated hiring decision. Not assessed does not mean low skill.
              </p>
              <p className="break-words text-sm leading-relaxed text-foreground whitespace-pre-wrap [overflow-wrap:anywhere]">
                {report.culture_narrative || "No culture narrative is available. The skill comparison below is rule-based."}
              </p>
              {report.overall_narrative && (
                <>
                  <Separator />
                  <div>
                    <h2 className="mb-2 text-sm font-medium">Overall summary</h2>
                    <p className="break-words text-sm leading-relaxed text-foreground whitespace-pre-wrap [overflow-wrap:anywhere]">
                      {report.overall_narrative}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {portfolio && portfolio.skills.some((skill) => skill.is_discovered) && (
            <>
              <Separator />
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Discovered Skills (not in vacancy requirements)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 px-4 pb-4">
                  {portfolio.skills
                    .filter((skill) => skill.is_discovered)
                    .map((skill) => (
                      <div key={skill.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                        <span className="break-words font-medium">{skill.skill_label}</span>
                        <span className="text-muted-foreground">
                          {LEVEL_LABELS[skill.ai_level] ?? "Unrated"} ({skill.ai_confidence?.toLowerCase() === "low" ? "low confidence" : "confidence assessed"})
                        </span>
                        <span className="text-xs text-muted-foreground">Not required for this role; may be additive.</span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
