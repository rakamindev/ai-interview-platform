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
import { LEVEL_LABELS } from "@/utils/constants";
import type { FitGapReport, Portfolio } from "@/types";

const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 36; // 36 x 5 s = 3 minutes

// Discovered skills are model-only judgments, so show the level and the confidence the model gave.
const levelText = (level: string | number) =>
  typeof level === "number" ? LEVEL_LABELS[level] ?? `L${level}` : level;

function confidenceText(confidence?: string) {
  const value = confidence?.toLowerCase();
  return value === "high" || value === "medium" || value === "low" ? `${value} confidence` : "confidence unknown";
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
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const pollCount = useRef(0);

  const portfolioReady = portfolio?.generation_status === "complete";

  // One GET. It never starts generation, so it is safe to call from a timer.
  const loadReport = useCallback(async (): Promise<"ready" | "missing" | "error"> => {
    if (!portfolio) return "error";
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
      setError(null);
      return "ready";
    } catch (e: any) {
      if (e?.response?.status === 404) return "missing";
      setGenerating(false);
      setError("The report could not be loaded. Please try again.");
      return "error";
    }
  }, [portfolio, vacancyId]);

  // Opening the page: show the report if it exists, otherwise ask the API to generate it once.
  const loadOrGenerate = useCallback(async () => {
    if (!portfolio) return;
    setError(null);
    pollCount.current = 0;
    const status = await loadReport();
    if (status !== "missing") return;
    try {
      await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
      setGenerating(true);
    } catch {
      setGenerating(false);
      setError("The report could not be generated. Please try again.");
    }
  }, [portfolio, vacancyId, loadReport]);

  // While generating, only check whether the report exists. Give up after about 3 minutes.
  const pollReport = useCallback(async () => {
    pollCount.current += 1;
    const status = await loadReport();
    if (status === "missing" && pollCount.current >= MAX_POLLS) {
      setGenerating(false);
      setError("The report is taking longer than expected. Try Regenerate in a minute.");
    }
  }, [loadReport]);

  useEffect(() => {
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then((res) => {
        const data = res.data as any;
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        }
      })
      .catch((e: any) => {
        if (e?.response?.status !== 404) setError("The portfolio could not be loaded. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (portfolioReady) loadOrGenerate();
  }, [portfolioReady, loadOrGenerate]);

  usePolling(pollReport, POLL_INTERVAL_MS, generating && portfolioReady);

  const retry = () => (portfolioReady ? loadOrGenerate() : window.location.reload());

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    setError(null);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      pollCount.current = 0;
      setReport(null);
      setGenerating(true);
    } catch {
      setError("Regeneration could not be started. Please try again.");
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
      // Before, a failed export did nothing visible: the button stopped spinning and that was all.
      setExportError(`The ${format.toUpperCase()} export could not be created. Please try again.`);
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
        <div className="space-y-1">
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
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || generating || !portfolioReady}>
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

      {exportError && (
        <p role="alert" className="border border-destructive/40 rounded-lg px-4 py-3 text-sm">
          {exportError}
        </p>
      )}

      {/* Something went wrong */}
      {error && (
        <div role="alert" className="border border-destructive/40 rounded-lg p-4 flex items-center justify-between gap-4">
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={retry}>Try again</Button>
        </div>
      )}

      {/* No portfolio, or not finished yet */}
      {!error && !portfolio && (
        <div className="border rounded-lg p-8 text-center space-y-1">
          <p className="text-sm font-medium">No portfolio yet</p>
          <p className="text-sm text-muted-foreground">
            The fit/gap report needs a finished interview and a generated portfolio.
          </p>
        </div>
      )}
      {portfolio && !portfolioReady && (
        <div className="border rounded-lg p-8 text-center space-y-1">
          <p className="text-sm font-medium">
            {portfolio.generation_status === "failed" ? "Portfolio generation failed" : "The portfolio is not ready yet"}
          </p>
          <p className="text-sm text-muted-foreground">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Open the portfolio page
            </Link>{" "}
            {portfolio.generation_status === "failed" ? "to regenerate it" : "and come back when it is complete"}.
          </p>
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
                      <div key={s.id} className="text-sm flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="font-medium">{s.skill_label}</span>
                        <span className="text-muted-foreground">
                          {levelText(s.ai_level)} · {confidenceText(s.ai_confidence)}
                        </span>
                        <span className="text-xs text-muted-foreground">Not required for this role, may be additive.</span>
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
