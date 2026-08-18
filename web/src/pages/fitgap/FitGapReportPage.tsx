import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import { AlertTriangle, ArrowLeft, Download, Loader2, RefreshCw, Zap } from "lucide-react";
import { Callout } from "@/components/ui/callout";
import { EmptyState } from "@/components/ui/empty-state";
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
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // No report row exists until the job finishes, so polling sees 404 until then.
  // Requesting generation on each of those polls queued a fresh LLM run every
  // five seconds — one report ran five times, each overwriting the last
  // recommendation with a different one.
  const requestedRef = useRef(false);

  // A 404 here means "not built yet", not "missing". Treating it as an error
  // showed the assessor a red failure while the job was merely queued.
  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
      setLoadError(null);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        if (requestedRef.current) {
          setGenerating(true);
          return;
        }
        try {
          requestedRef.current = true;
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          setGenerating(true);
          setLoadError(null);
        } catch (triggerError: any) {
          requestedRef.current = false;
          setGenerating(false);
          setLoadError(
            triggerError?.response?.data?.errors?.[0]?.message ??
              "Could not start the fit/gap analysis.",
          );
        }
      } else {
        setGenerating(false);
        setLoadError(
          e?.response?.data?.errors?.[0]?.message ??
            e?.message ??
            "Could not load the fit/gap report.",
        );
      }
    }
  }, [portfolio, vacancyId]);

  useEffect(() => {
    requestedRef.current = false;
  }, [vacancyId]);

  useEffect(() => {
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then(async (res) => {
        const data = res.data as any;
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        }
      })
      .catch((e: any) => {
        setLoadError(
          e?.response?.data?.errors?.[0]?.message ??
            e?.message ??
            "Could not load this portfolio.",
        );
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (portfolio) fetchReport();
  }, [portfolio, fetchReport]);

  const stalled = usePolling(fetchReport, 5000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    try {
      requestedRef.current = true;
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      setGenerating(true);
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
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-semibold">Fit/Gap Report</h1>
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

      {/* Error */}
      {!generating && loadError && (
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Could not load the fit/gap report"
          description={loadError}
          action={
            <Button variant="outline" size="sm" onClick={() => fetchReport()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try again
            </Button>
          }
        />
      )}

      {/* The only state separating "not ready yet" from "not there". */}
      {generating && !stalled && (
        <div className="space-y-3 rounded-lg border p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Building the fit/gap report</p>
            <p className="text-xs text-muted-foreground">
              Comparing the portfolio against the vacancy and writing the narrative. This
              usually takes under a minute.
            </p>
          </div>
        </div>
      )}

      {/* Polling gave up. Without this the screen would sit still and, unlike the
          old endless spinner, no longer even be asking. */}
      {generating && stalled && (
        <Callout variant="warning" title="This is taking longer than expected">
          <div className="space-y-2">
            <p>
              The report has not arrived after five minutes. The job may still be
              queued, or the background worker may not be running. Nothing has been
              lost — the portfolio it compares against is untouched.
            </p>
            <Button variant="outline" size="sm" onClick={() => fetchReport()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Check again
            </Button>
          </div>
        </Callout>
      )}

      {/* Nothing running, nothing broken, nothing to read. */}
      {!generating && !loadError && !report && !loading && (
        <EmptyState
          title="No fit/gap report yet"
          description="Nothing has been compared against this vacancy."
          action={
            <Button variant="outline" size="sm" onClick={() => fetchReport()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Build it now
            </Button>
          }
        />
      )}

      {/* Report ready */}
      {report && (
        <>
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
            <CardContent className="space-y-3 px-4 pb-4">
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                {report.culture_narrative || report.overall_narrative}
              </p>
              <Callout variant="info">
                Written by a language model from the level comparison above. It is a
                recommendation for a human to weigh, not a decision, and it has not seen the
                interview itself.
              </Callout>
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
                      <div key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span className="break-words font-medium">{s.skill_label}</span>
                        <span className="text-muted-foreground">
                          {s.assessed ? `L${s.ai_level} · ${s.ai_confidence} confidence` : "not assessed"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          — Not in the vacancy, so it is not scored above.
                        </span>
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
