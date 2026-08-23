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
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Zap,
  TriangleAlert,
  Info,
} from "lucide-react";
import type { FitGapReport, Portfolio, ConfidenceLevel } from "@/types";

/**
 * Generation is asynchronous, so this screen polls. Polling needs a bound:
 * previously `generating` was only ever cleared by a successful fetch, so a
 * job that exhausted its Sidekiq retries left the spinner turning forever
 * with no way for the assessor to learn that nothing was coming.
 */
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;
const MAX_POLLS = POLL_TIMEOUT_MS / POLL_INTERVAL_MS;

const CONFIDENCE_COPY: Record<ConfidenceLevel, string> = {
  high: "high confidence",
  medium: "medium confidence",
  low: "low confidence",
};

type LoadError = { kind: "load" | "generate"; message: string };

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
  const [error, setError] = useState<LoadError | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  const pollCount = useRef(0);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
      setTimedOut(false);
      setError(null);
      pollCount.current = 0;
    } catch (e: any) {
      const status = e?.response?.status;

      if (status === 404) {
        // No report yet — ask for one. Only on the first pass; while polling a
        // 404 just means the worker has not finished.
        if (!generating) {
          try {
            await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
            setGenerating(true);
            pollCount.current = 0;
          } catch (triggerErr: any) {
            setGenerating(false);
            setError({
              kind: "generate",
              message:
                triggerErr?.response?.data?.error ??
                "Could not start report generation.",
            });
          }
        } else {
          pollCount.current += 1;
          if (pollCount.current >= MAX_POLLS) {
            setGenerating(false);
            setTimedOut(true);
          }
        }
        return;
      }

      // Every non-404 was previously swallowed, leaving a blank page with no
      // explanation and no way to retry.
      setGenerating(false);
      setError({
        kind: "load",
        message:
          e?.response?.data?.error ??
          (status ? `The server returned ${status}.` : "Could not reach the server."),
      });
    }
  }, [portfolio, vacancyId, generating]);

  useEffect(() => {
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then((res) => {
        const data = res.data as any;
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        } else {
          setError({
            kind: "load",
            message: "This session has no portfolio yet, so there is nothing to compare.",
          });
        }
      })
      .catch((e: any) => {
        setError({
          kind: "load",
          message:
            e?.response?.data?.error ?? "Could not load the portfolio for this session.",
        });
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (portfolio) fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio]);

  usePolling(fetchReport, POLL_INTERVAL_MS, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    setError(null);
    setTimedOut(false);
    pollCount.current = 0;
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      setGenerating(true);
    } catch (e: any) {
      setError({
        kind: "generate",
        message: e?.response?.data?.error ?? "Could not queue a regeneration.",
      });
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setError(null);
    try {
      const res = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
      const blob =
        format === "pdf"
          ? new Blob([res.data as BlobPart], { type: "application/pdf" })
          : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitgap-${sessionId}-${vacancyId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError({
        kind: "load",
        message:
          e?.response?.data?.error ?? `The ${format.toUpperCase()} export could not be produced.`,
      });
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const isFallbackNarrative = report?.narrative_status === "fallback";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
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

        {portfolio && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating || generating}
            >
              {regenerating ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
              )}
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
                  {exporting === "pdf" ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="mr-1 h-3.5 w-3.5" />
                  )}
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("json")}
                  disabled={!!exporting}
                >
                  {exporting === "json" ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="mr-1 h-3.5 w-3.5" />
                  )}
                  JSON
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-red-900">
              {error.kind === "generate"
                ? "Report generation could not be started"
                : "This report could not be loaded"}
            </p>
            <p className="mt-0.5 text-xs text-red-800">{error.message}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 bg-white"
            onClick={() => {
              setError(null);
              fetchReport();
            }}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Generating */}
      {generating && (
        <div className="space-y-3 rounded-lg border p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">Generating fit/gap report…</p>
          <p className="text-xs text-muted-foreground">
            This usually takes under a minute.
          </p>
        </div>
      )}

      {/* Generation never completed — terminal, actionable, not an endless spinner */}
      {timedOut && !report && (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-8 text-center">
          <TriangleAlert className="mx-auto h-7 w-7 text-amber-600" aria-hidden />
          <div>
            <p className="text-sm font-medium text-amber-900">Report is still not ready</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-amber-800">
              Generation has not completed after three minutes, which usually means the
              background job failed. Nothing has been written, so it is safe to try again.
            </p>
          </div>
          <Button variant="outline" size="sm" className="bg-white" onClick={handleRegenerate}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Try again
          </Button>
        </div>
      )}

      {/* Report ready */}
      {report && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Skill Comparison</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                {isFallbackNarrative ? "Summary" : "Culture & Competency Fit"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              {/* Previously the mechanical stub was rendered under the
                  "Culture & Competency Fit" heading with nothing to indicate
                  the model had failed — a skill count presented as a
                  judgement about how someone works. */}
              {isFallbackNarrative && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
                  <p className="text-xs leading-relaxed text-amber-900">
                    The AI narrative could not be generated for this report. The text below is a
                    mechanical summary of the table above — it contains no culture or competency
                    assessment. Regenerate to try again.
                  </p>
                </div>
              )}
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {report.culture_narrative || report.overall_narrative}
              </p>
            </CardContent>
          </Card>

          {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
            <>
              <Separator />
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <Zap className="h-4 w-4 text-amber-500" aria-hidden />
                    Discovered Skills (not in vacancy requirements)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 px-4 pb-4">
                  {portfolio.skills
                    .filter((s) => s.is_discovered)
                    .map((s) => (
                      <div key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span className="font-medium">{s.skill_label}</span>
                        <span className="text-muted-foreground">
                          {/* ai_level is an integer; the old code rendered it
                              raw, printing "3" where every other surface says
                              "L3". And medium confidence was labelled
                              "confirmed" — the model confirms nothing. */}
                          {s.ai_level != null ? LEVEL_LABELS[s.ai_level] ?? `L${s.ai_level}` : "not rated"}
                          {" · "}
                          {CONFIDENCE_COPY[s.ai_confidence] ?? "confidence unknown"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          — Not required for this role, may be additive.
                        </span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* Nothing to show and nothing in flight */}
      {!report && !generating && !timedOut && !error && (
        <div className="rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="text-sm font-medium">No report yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Generate a fit/gap report to compare this candidate's portfolio against the role
            requirements.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={handleRegenerate}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Generate report
          </Button>
        </div>
      )}
    </div>
  );
}
