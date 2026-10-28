import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import StateView from "@/components/StateView";
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
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [failedAction, setFailedAction] = useState<"regenerate" | "pdf" | "json" | null>(null);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
      setError(null);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        try {
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          setGenerating(true);
          setError(null);
        } catch {
          setGenerating(false);
          setError("Failed to load fit/gap report.");
        }
      } else {
        setError("Failed to load fit/gap report.");
      }
    } finally {
      setReportLoading(false);
    }
  }, [portfolio, vacancyId]);

  const retryReport = async () => {
    setError(null);
    if (!portfolio) {
      setLoading(true);
      setReportLoading(true);
      await loadPortfolio();
      return;
    }
    setReportLoading(true);
    await fetchReport();
  };

  const loadPortfolio = useCallback(async () => {
    let hasPortfolio = false;
    setLoading(true);
    setError(null);
    try {
      const res = await sessionsApi.getPortfolio(Number(sessionId));
      const data = res.data as { portfolio?: Portfolio; status?: string };
      if (data.portfolio) {
        hasPortfolio = true;
        setPortfolio(data.portfolio);
        setGenerating(data.portfolio.generation_status === "generating" || data.portfolio.generation_status === "pending");
      } else if (data.status === "generating") {
        setGenerating(true);
      } else {
        setError("No portfolio is available for this session.");
      }
    } catch {
      setError("Failed to load portfolio.");
    } finally {
      setLoading(false);
      if (!hasPortfolio) setReportLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  useEffect(() => {
    if (portfolio) fetchReport();
  }, [portfolio, fetchReport]);

  usePolling(fetchReport, 5000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    setActionError(null);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      setGenerating(true);
      setFailedAction(null);
    } catch {
      setActionError("Failed to regenerate the fit/gap report.");
      setFailedAction("regenerate");
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
      setFailedAction(null);
    } catch {
      setActionError(`Failed to export the ${format.toUpperCase()} report.`);
      setFailedAction(format);
    } finally {
      setExporting(null);
    }
  };

  const retryAction = () => {
    if (failedAction === "regenerate") void handleRegenerate();
    else if (failedAction) void handleExport(failedAction);
  };

  return (
    <div className="max-w-2xl mx-auto min-w-0 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between min-w-0">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="truncate text-lg font-semibold">Fit/Gap Report</h1>
          </div>
        </div>

        {portfolio && (
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button className="min-h-10 w-full sm:min-h-8 sm:w-auto" variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || generating}>
              {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Regenerate
            </Button>
            {report && (
              <>
                <Button className="min-h-10 w-full sm:min-h-8 sm:w-auto" variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting}>
                  {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                  PDF
                </Button>
                <Button className="min-h-10 w-full sm:min-h-8 sm:w-auto" variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!!exporting}>
                  {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                  JSON
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {actionError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
          <span>{actionError}</span>
          <Button className="min-h-10 sm:min-h-8" variant="outline" size="sm" onClick={retryAction}>Retry</Button>
        </div>
      )}

      <StateView
        loading={loading || reportLoading}
        error={error}
        onRetry={() => void retryReport()}
        empty={!report && !generating && !!portfolio}
        emptyContent={<p className="text-sm text-muted-foreground">No fit/gap report available.</p>}
        loadingContent={
          <div className="max-w-2xl mx-auto space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-48 w-full" />
          </div>
        }
      >
        <>
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
              {/* Skill comparison */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Skill Comparison</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <ComparisonTable comparisons={Array.isArray(report.skill_comparisons) ? report.skill_comparisons : []} />
                </CardContent>
              </Card>

              <Separator />

              {/* Culture & competency */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Culture &amp; Competency Fit</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="break-words text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                    {report.culture_narrative || report.overall_narrative}
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
                          <div key={s.id} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            <span className="min-w-0 truncate font-medium">{s.skill_label}</span>
                            <span className="min-w-0 truncate text-muted-foreground">
                              {s.ai_level} ({s.ai_confidence?.toLowerCase() === "low" ? "low confidence" : "confirmed"})
                            </span>
                            <span className="min-w-0 truncate text-xs text-muted-foreground">— Not required for this role, may be additive.</span>
                          </div>
                        ))}
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </>
      </StateView>
    </div>
  );
}
