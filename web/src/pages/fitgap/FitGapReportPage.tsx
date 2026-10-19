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
    <div className="mx-auto max-w-3xl space-y-7">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              aria-label="Back to candidate results"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight">Role fit report</h1>
          </div>
        </div>

        {portfolio && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || generating}>
              {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Regenerate
            </Button>
            {report && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting || report.stale}>
                  {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!!exporting || report.stale}>
                  {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                  JSON
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/50 p-3 text-sm space-y-2">
          <p>{error.message}</p>
          <Button
            variant="outline"
            size="sm"
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
        <div className="border rounded-lg p-8 text-center space-y-2">
          <Loader2 className="h-7 w-7 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Generating portfolio...</p>
        </div>
      )}

      {/* Generating */}
      {generating && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Generating fit/gap report...</p>
        </div>
      )}

      {/* Report ready */}
      {report && (
        <>
          {report.stale && (
            <div role="alert" className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
              Vacancy requirements have changed. Regenerate this report before using it for a decision.
            </div>
          )}

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
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {report.culture_narrative || report.overall_narrative || "Narrative unavailable. Regenerate the report to retry."}
              </p>
            </CardContent>
          </Card>

          {/* Discovered skills */}
          {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
            <>
              <Separator />
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Discovered Skills (not in vacancy requirements)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {portfolio.skills
                    .filter((s) => s.is_discovered)
                    .map((s) => (
                      <div key={s.id} className="text-sm flex items-center gap-2">
                        <span className="font-medium">{s.skill_label}</span>
                        <span className="text-muted-foreground">
                          {s.ai_level} ({s.ai_confidence?.toLowerCase() === "low" ? "low confidence" : "confirmed"})
                        </span>
                        <span className="text-xs text-muted-foreground">— Not required for this role, may be additive.</span>
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
