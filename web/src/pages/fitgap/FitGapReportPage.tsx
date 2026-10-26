import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import { AlertTriangle, ArrowLeft, Bot, Download, Info, Loader2, RefreshCw, Zap } from "lucide-react";
import type { FitGapReport, FitGapSummary, Portfolio } from "@/types";

const POLL_MS = 5000;
// ~2 minutes of polling before we suggest the job may be stuck (e.g. worker down).
const SLOW_AFTER_POLLS = 24;

function errorMessage(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { message?: string; error?: string } } };
  return err?.response?.data?.message || err?.response?.data?.error || fallback;
}

function CoverageCard({ summary }: { summary: FitGapSummary }) {
  const partial = summary.not_assessed > 0;
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">
            Assessed {summary.assessed} of {summary.total} required skill{summary.total !== 1 ? "s" : ""}
          </p>
          <span className="text-sm tabular-nums text-muted-foreground">{summary.coverage_pct}% coverage</span>
        </div>
        <Progress value={summary.coverage_pct} aria-label="Skill coverage" />
        {partial && (
          <div role="status" className="flex gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            <p>
              {summary.not_assessed} required skill{summary.not_assessed !== 1 ? "s were" : " was"} not covered in the
              interview. This is missing evidence, not a low score — don't read the result as a complete verdict.
            </p>
          </div>
        )}
        {summary.low_confidence > 0 && (
          <p className="flex gap-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" aria-hidden />
            {summary.low_confidence} result{summary.low_confidence !== 1 ? "s rely" : " relies"} on low-confidence AI
            evidence. Review the transcript or override before deciding.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StateCard({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="border rounded-lg px-6 py-10 text-center space-y-3">
      <div className="mx-auto w-fit">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      {children}
    </div>
  );
}

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const loadPortfolio = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then((res) => {
        const data = res.data as { portfolio?: Portfolio };
        if (data.portfolio) setPortfolio(data.portfolio);
        else setLoadError("The candidate portfolio is not ready yet. Come back once it has been generated.");
      })
      .catch((e) => setLoadError(errorMessage(e, "Could not load the candidate portfolio.")))
      .finally(() => setLoading(false));
  }, [sessionId]);

  // GET only: polling never re-queues generation (the API is idempotent, but each POST costs a round trip).
  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setLoadError(null);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status !== 404) {
        setLoadError(errorMessage(e, "Could not load the fit/gap report."));
        return;
      }
      try {
        const res = await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
        setReport(res.data.report);
      } catch (err) {
        setLoadError(errorMessage(err, "Could not start the fit/gap report."));
      }
    }
  }, [portfolio, vacancyId]);

  useEffect(loadPortfolio, [loadPortfolio]);

  useEffect(() => {
    if (portfolio) fetchReport();
  }, [portfolio, fetchReport]);

  const generating = report?.status === "generating";
  usePolling(
    () => {
      setPolls((n) => n + 1);
      return fetchReport();
    },
    POLL_MS,
    generating && !loadError,
  );

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    setLoadError(null);
    try {
      const res = await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setPolls(0);
    } catch (e) {
      setLoadError(errorMessage(e, "Could not restart the fit/gap report."));
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
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
    } catch (e) {
      setLoadError(errorMessage(e, `Could not export the ${format.toUpperCase()}.`));
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const ready = report?.status === "ready";
  const hasContent = !!report && report.skill_comparisons.length > 0;
  const fallback = report?.narrative_source === "fallback";
  const narrative = report?.culture_narrative || report?.overall_narrative;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Back to portfolio"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-semibold">Fit/Gap Report</h1>
        </div>

        {portfolio && report && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || generating}>
              {regenerating ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Regenerate
            </Button>
            {ready && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting}>
                  {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!!exporting}>
                  {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                  JSON
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error: network/5xx or missing portfolio — never a blank page */}
      {loadError && (
        <StateCard icon={<AlertTriangle className="h-8 w-8 text-destructive" />} title="Something went wrong">
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button size="sm" variant="outline" onClick={portfolio ? fetchReport : loadPortfolio}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Try again
          </Button>
        </StateCard>
      )}

      {/* Failed generation: explicit, retryable */}
      {!loadError && report?.status === "failed" && (
        <StateCard icon={<AlertTriangle className="h-8 w-8 text-destructive" />} title="The report could not be generated">
          <p className="text-sm text-muted-foreground">{report.error_message || "Please try again."}</p>
          <Button size="sm" onClick={handleRegenerate} disabled={regenerating}>
            {regenerating ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
            Try again
          </Button>
        </StateCard>
      )}

      {/* Generating with nothing to show yet */}
      {!loadError && generating && !hasContent && (
        <StateCard icon={<Loader2 className="h-8 w-8 animate-spin text-primary" />} title="Generating fit/gap report...">
          <p className="text-xs text-muted-foreground">This usually takes under a minute. The page updates by itself.</p>
          {polls >= SLOW_AFTER_POLLS && (
            <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={regenerating}>
              Taking too long? Restart
            </Button>
          )}
        </StateCard>
      )}

      {/* Regenerating over an existing report (e.g. after an override): keep showing the last version */}
      {!loadError && generating && hasContent && (
        <div role="status" className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Updating with the latest assessor changes — showing the previous version meanwhile.
        </div>
      )}

      {/* Vacancy without required skills */}
      {!loadError && ready && report.summary.total === 0 && (
        <StateCard icon={<Info className="h-8 w-8 text-muted-foreground" />} title="This vacancy has no required skills">
          <p className="text-sm text-muted-foreground">Add required skills to the vacancy to compare candidates against it.</p>
          <Button asChild size="sm" variant="outline">
            <Link to={`/vacancies/${vacancyId}/edit`}>Edit vacancy</Link>
          </Button>
        </StateCard>
      )}

      {!loadError && report && hasContent && (report.status !== "failed") && (
        <>
          <CoverageCard summary={report.summary} />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Skill Comparison</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 pb-4">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          {narrative && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex flex-wrap items-center gap-2">
                  {fallback ? "Automatic summary" : "Culture & Competency Fit"}
                  {fallback ? (
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">
                      AI summary unavailable
                    </span>
                  ) : report.narrative_source === "ai" && (
                    <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-normal text-primary">
                      <Bot className="h-3 w-3" aria-hidden /> AI-generated
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">{narrative}</p>
              </CardContent>
            </Card>
          )}

          {/* Discovered skills */}
          {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
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
                    <div key={s.id} className="text-sm flex flex-wrap items-center gap-x-2">
                      <span className="font-medium break-words">{s.skill_label}</span>
                      <span className="text-muted-foreground">
                        L{s.ai_level} ({s.ai_confidence?.toLowerCase() === "low" ? "low confidence" : "confirmed"})
                      </span>
                      <span className="text-xs text-muted-foreground">— Not required for this role, may be additive.</span>
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
