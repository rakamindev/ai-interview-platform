import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import { countResults, pluralize } from "@/utils/skills";
import { LEVEL_LABELS } from "@/utils/constants";
import { AlertCircle, ArrowLeft, Download, Info, Loader2, RefreshCw, Zap } from "lucide-react";
import type { FitGapReport, Portfolio } from "@/types";

type PageStatus = "loading" | "load_error" | "not_ready" | "generating" | "timed_out" | "ready";

export const POLL_INTERVAL_MS = 5000;
export const MAX_POLLS = 24;

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [status, setStatus] = useState<PageStatus>("loading");
  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const pollCount = useRef(0);

  const startGeneration = useCallback(async (portfolioId: number, regenerate = false) => {
    pollCount.current = 0;
    setReport(null);
    setActionError(null);
    try {
      if (regenerate) {
        await portfoliosApi.regenerateFitGap(portfolioId, Number(vacancyId));
      } else {
        await portfoliosApi.triggerFitGap(portfolioId, Number(vacancyId));
      }
      setStatus("generating");
    } catch {
      setStatus("load_error");
    }
  }, [vacancyId]);

  const loadReport = useCallback(async (portfolioId: number) => {
    try {
      const res = await portfoliosApi.getFitGap(portfolioId, Number(vacancyId));
      setReport(res.data.report);
      setStatus("ready");
    } catch (e: any) {
      if (e?.response?.status === 404) {
        await startGeneration(portfolioId);
      } else {
        setStatus("load_error");
      }
    }
  }, [vacancyId, startGeneration]);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await sessionsApi.getPortfolio(Number(sessionId));
      const data = res.data as { portfolio?: Portfolio };
      if (!data.portfolio || data.portfolio.generation_status !== "complete") {
        setStatus("not_ready");
        return;
      }
      setPortfolio(data.portfolio);
      await loadReport(data.portfolio.id);
    } catch {
      setStatus("load_error");
    }
  }, [sessionId, loadReport]);

  useEffect(() => {
    load();
  }, [load]);

  const poll = useCallback(async () => {
    if (!portfolio) return;
    pollCount.current += 1;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setStatus("ready");
    } catch {
      if (pollCount.current >= MAX_POLLS) setStatus("timed_out");
    }
  }, [portfolio, vacancyId]);

  usePolling(poll, POLL_INTERVAL_MS, status === "generating");

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setActionError(null);
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
    } catch {
      setActionError(`Couldn't export the ${format.toUpperCase()}. Try again in a moment.`);
    } finally {
      setExporting(null);
    }
  };

  if (status === "loading") {
    return (
      <div className="max-w-2xl mx-auto space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const counts = report ? countResults(report.skill_comparisons) : null;
  const discoveredSkills = portfolio?.skills.filter((s) => s.is_discovered && s.ai_level != null) ?? [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Back to portfolio"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-semibold">Fit/gap report</h1>
        </div>

        {portfolio && (status === "ready" || status === "timed_out") && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => startGeneration(portfolio.id, true)}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
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

      {actionError && (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      )}

      {status === "load_error" && (
        <div className="border border-destructive/40 rounded-lg p-6 text-center space-y-3">
          <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
          <p className="text-sm">Couldn't load the fit/gap report. Try again, or go back to the portfolio.</p>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try again
          </Button>
        </div>
      )}

      {status === "not_ready" && (
        <div className="border rounded-lg p-6 text-center space-y-3">
          <p className="text-sm">The portfolio for this session isn't ready yet, so there's nothing to compare.</p>
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="inline-block text-sm font-medium text-primary hover:underline"
          >
            Back to portfolio
          </Link>
        </div>
      )}

      {status === "generating" && (
        <div className="border rounded-lg p-12 text-center space-y-3" role="status">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Generating fit/gap report. This page updates on its own.</p>
        </div>
      )}

      {status === "timed_out" && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-6 text-center space-y-3">
          <p className="text-sm text-amber-900">
            The report is taking longer than usual. It may still finish, or the AI service may be busy.
          </p>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Check again
          </Button>
        </div>
      )}

      {status === "ready" && report && counts && (
        <>
          {counts.notAssessed > 0 && (
            <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                {pluralize(counts.notAssessed, "required skill")} {counts.notAssessed === 1 ? "has" : "have"} no
                rating. This report can't tell whether the candidate meets{" "}
                {counts.notAssessed === 1 ? "it" : "them"}, so verify before deciding.
              </p>
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Skill comparison</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {report.skill_comparisons.length === 0 ? (
                <p className="text-sm text-muted-foreground">This vacancy has no required skills to compare.</p>
              ) : (
                <ComparisonTable comparisons={report.skill_comparisons} />
              )}
            </CardContent>
          </Card>

          {report.overall_narrative && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Overall assessment</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{report.overall_narrative}</p>
              </CardContent>
            </Card>
          )}

          {report.culture_narrative && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Culture &amp; competency fit</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{report.culture_narrative}</p>
              </CardContent>
            </Card>
          )}

          {discoveredSkills.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Discovered skills
                </CardTitle>
                <p className="text-xs text-muted-foreground">Not required for this role, but may add value.</p>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {discoveredSkills.map((s) => (
                  <div key={s.id} className="text-sm flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium break-words">{s.skill_label}</span>
                    <span className="text-muted-foreground">
                      {LEVEL_LABELS[s.ai_level as number]}, {s.ai_confidence ?? "unknown"} confidence
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
