import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap } from "lucide-react";
import type { FitGapReport, Portfolio } from "@/types";

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [portfolioGenerating, setPortfolioGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ scope: "portfolio" | "report" | "regenerate"; message: string } | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [retryingPortfolio, setRetryingPortfolio] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const fetchingReport = useRef(false);
  const fetchingPortfolio = useRef(false);

  const fetchReport = useCallback(async () => {
    if (!portfolio || fetchingReport.current) return;
    fetchingReport.current = true;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
      setError(null);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        try {
          const res = await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          if ("report" in res.data) {
            setReport(res.data.report);
            setGenerating(false);
          } else {
            setGenerating(true);
          }
          setError(null);
        } catch (triggerError: any) {
          setGenerating(false);
          setError({
            scope: "report",
            message: triggerError?.response?.data?.errors?.[0]?.message ?? "Could not start Fit/Gap generation.",
          });
        }
      } else {
        setGenerating(false);
        setError({
          scope: "report",
          message: e?.response?.data?.errors?.[0]?.message ?? "Could not load the Fit/Gap report.",
        });
      }
    } finally {
      fetchingReport.current = false;
    }
  }, [portfolio, vacancyId]);

  const fetchPortfolio = useCallback(async () => {
    if (fetchingPortfolio.current) return;
    fetchingPortfolio.current = true;
    try {
      const res = await sessionsApi.getPortfolio(Number(sessionId));
      const data = res.data as any;
      if (data.status === "generating") {
        setPortfolioGenerating(true);
        setError(null);
      } else if (data.portfolio) {
        setPortfolio(data.portfolio);
        const status = data.portfolio.generation_status;
        setPortfolioGenerating(status === "pending" || status === "generating");
        if (status === "failed") {
          setError({
            scope: "portfolio",
            message: data.error ?? data.portfolio.generation_error ?? "Portfolio generation failed.",
          });
        } else {
          setError(null);
        }
      } else {
        setError({ scope: "portfolio", message: "Portfolio is not available for this session." });
      }
    } catch (e: any) {
      setError({
        scope: "portfolio",
        message: e?.response?.data?.errors?.[0]?.message ?? "Could not load the portfolio.",
      });
    } finally {
      setLoading(false);
      fetchingPortfolio.current = false;
    }
  }, [sessionId]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  useEffect(() => {
    if (portfolio?.generation_status === "complete") fetchReport();
  }, [portfolio, fetchReport]);

  usePolling(fetchReport, 5000, generating && !!portfolio);
  usePolling(fetchPortfolio, 5000, portfolioGenerating);

  const retryPortfolio = async () => {
    setRetryingPortfolio(true);
    try {
      if (portfolio?.generation_status === "failed") {
        await sessionsApi.regeneratePortfolio(Number(sessionId));
        setPortfolio(null);
        setPortfolioGenerating(true);
        setError(null);
      } else {
        await fetchPortfolio();
      }
    } catch (e: any) {
      setError({
        scope: "portfolio",
        message: e?.response?.data?.errors?.[0]?.message ?? "Could not retry portfolio generation.",
      });
    } finally {
      setRetryingPortfolio(false);
    }
  };

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      setGenerating(true);
      setError(null);
    } catch (e: any) {
      setError({
        scope: "regenerate",
        message: e?.response?.data?.errors?.[0]?.message ?? "Could not regenerate the Fit/Gap report.",
      });
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setExportError(null);
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
    } catch {
      setExportError(`Could not export the report as ${format.toUpperCase()}. Try again.`);
    } finally {
      setExporting(null);
    }
  };

  const retry = () => {
    if (error?.scope === "portfolio") return retryPortfolio();
    if (error?.scope === "regenerate") return handleRegenerate();
    return fetchReport();
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
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-5 border-b pb-6">
        <Link
          to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
          className="inline-flex min-h-11 items-center gap-2 rounded-md pr-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Candidate results
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">Role fit report</h1>
            <p className="text-sm leading-6 text-muted-foreground">Compare assessed skills with the selected vacancy requirements.</p>
          </div>
          {portfolio && (
            <div className="flex flex-wrap gap-2 sm:shrink-0">
            <Button variant="outline" className="min-h-11" onClick={handleRegenerate} disabled={regenerating || generating}>
              {regenerating ? <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw aria-hidden="true" className="mr-1.5 h-4 w-4" />}
              Regenerate
            </Button>
            {report && (
              <>
                <Button variant="outline" className="min-h-11" onClick={() => handleExport("pdf")} disabled={!!exporting || report.stale}>
                  {exporting === "pdf" ? <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" /> : <Download aria-hidden="true" className="mr-1.5 h-4 w-4" />}
                  Export PDF
                </Button>
                <Button variant="outline" className="min-h-11" onClick={() => handleExport("json")} disabled={!!exporting || report.stale}>
                  {exporting === "json" ? <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" /> : <Download aria-hidden="true" className="mr-1.5 h-4 w-4" />}
                  Export JSON
                </Button>
              </>
            )}
            </div>
          )}
        </div>
      </div>

      {exportError && <div role="alert" className="rounded-lg border border-destructive/40 bg-card p-4 text-sm text-destructive">{exportError}</div>}

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/50 p-3 text-sm space-y-2">
          <p>{error.message}</p>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={retry}
            disabled={retryingPortfolio || regenerating}
          >
            {error.scope === "portfolio" && portfolio?.generation_status === "failed"
              ? "Retry portfolio generation"
              : "Retry"}
          </Button>
        </div>
      )}

      {portfolioGenerating && (
        <div role="status" className="space-y-3 rounded-xl border bg-card px-6 py-12 text-center">
          <Loader2 aria-hidden="true" className="mx-auto h-7 w-7 animate-spin text-primary" />
          <p className="font-medium">Preparing candidate data</p>
          <p className="text-sm text-muted-foreground">The portfolio is still being generated. This report will load when it is ready.</p>
        </div>
      )}

      {/* Generating */}
      {generating && (
        <div role="status" className="space-y-3 rounded-xl border bg-card px-6 py-12 text-center">
          <Loader2 aria-hidden="true" className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="font-medium">Generating fit and gap report</p>
          <p className="text-sm text-muted-foreground">This report will appear here when the comparison is complete.</p>
        </div>
      )}

      {/* Report ready */}
      {report && (
        <>
          {report.stale && (
            <div role="alert" className="rounded-lg border border-amber-700/40 bg-amber-50 p-4 text-sm text-amber-900">
              Vacancy requirements have changed. Regenerate this report before using it for a decision.
            </div>
          )}

          {/* Skill comparison */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Skill comparison</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">Review each required skill against the candidate’s assessed level.</p>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          {/* Culture & competency */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Culture and competency fit</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {report.narrative_status === "fallback" && (
                <p role="status" className="mb-3 text-sm text-muted-foreground">
                  AI narrative is unavailable. This is a rule-based summary; regenerate to retry.
                </p>
              )}
              {report.narrative_status === "unknown" && (
                <p role="status" className="mb-3 text-sm text-muted-foreground">
                  Narrative source is unknown for this older report. Regenerate to refresh it.
                </p>
              )}
              <p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground">
                {report.culture_narrative || report.overall_narrative || "Narrative unavailable. Regenerate the report to retry."}
              </p>
            </CardContent>
          </Card>

          {/* Discovered skills */}
          {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Zap aria-hidden="true" className="h-4 w-4 text-amber-700" />
                    Discovered Skills (not in vacancy requirements)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {portfolio.skills
                    .filter((s) => s.is_discovered)
                    .map((s) => (
                      <div key={s.id} className="flex flex-col gap-1 border-b py-2 text-sm last:border-0 sm:flex-row sm:items-start sm:gap-2">
                        <span className="break-words font-medium">{s.skill_label}</span>
                        <span className="text-muted-foreground">
                          {s.ai_level} ({s.ai_confidence?.toLowerCase() === "low" ? "low confidence" : "confirmed"})
                        </span>
                        <span className="text-sm text-muted-foreground">Not required for this role, may be additive.</span>
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
