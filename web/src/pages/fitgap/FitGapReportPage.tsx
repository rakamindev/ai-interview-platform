import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { LEVEL_LABELS } from "@/utils/constants";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  FileQuestion,
  Loader2,
  RefreshCw,
  Zap,
} from "lucide-react";
import type { FitGapReport, Portfolio } from "@/types";

/**
 * Every state this page can actually be in.
 *
 * It previously modelled only loading / generating / report. A failed portfolio
 * fetch was swallowed by a bare `.finally`, leaving a header above blank space
 * with nothing to click; and polling ran every five seconds forever, so a dead
 * Sidekiq worker produced an infinite spinner and no way out.
 */
type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "empty" }
  | { kind: "generating" }
  | { kind: "timed_out" }
  | { kind: "ready"; report: FitGapReport };

const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 24; // ~2 minutes, then hand control back to the user

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "The report could not be loaded.";
}

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const attempts = useRef(0);

  const fetchReport = useCallback(
    async (current: Portfolio) => {
      try {
        const report = await portfoliosApi.getFitGap(current.id, Number(vacancyId));
        attempts.current = 0;
        setState({ kind: "ready", report });
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status;

        // 404 means it has not been generated yet — ask for it, then poll.
        if (status === 404) {
          try {
            await portfoliosApi.triggerFitGap(current.id, Number(vacancyId));
            setState({ kind: "generating" });
          } catch (triggerError) {
            setState({ kind: "error", message: errorMessage(triggerError) });
          }
          return;
        }

        setState({ kind: "error", message: errorMessage(e) });
      }
    },
    [vacancyId],
  );

  useEffect(() => {
    let cancelled = false;

    portfoliosApi
      .getPortfolio(Number(sessionId))
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setState({ kind: "empty" });
          return;
        }
        setPortfolio(result);
        return fetchReport(result);
      })
      .catch((e) => {
        if (!cancelled) setState({ kind: "error", message: errorMessage(e) });
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, fetchReport]);

  // Bounded polling. Giving up visibly is more useful than spinning forever.
  const poll = useCallback(() => {
    if (!portfolio) return;
    attempts.current += 1;
    if (attempts.current > MAX_POLL_ATTEMPTS) {
      setState({ kind: "timed_out" });
      return;
    }
    void fetchReport(portfolio);
  }, [portfolio, fetchReport]);

  usePolling(poll, POLL_INTERVAL_MS, state.kind === "generating" && !!portfolio);

  const retry = () => {
    attempts.current = 0;
    if (!portfolio) {
      setState({ kind: "loading" });
      portfoliosApi
        .getPortfolio(Number(sessionId))
        .then((result) => (result ? (setPortfolio(result), fetchReport(result)) : setState({ kind: "empty" })))
        .catch((e) => setState({ kind: "error", message: errorMessage(e) }));
      return;
    }
    setState({ kind: "loading" });
    void fetchReport(portfolio);
  };

  const handleRegenerate = async () => {
    if (!portfolio) return;
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      attempts.current = 0;
      setState({ kind: "generating" });
    } catch (e: unknown) {
      // Previously this set generating: true even when the request threw,
      // so a failed regeneration showed a spinner that could never resolve.
      setState({ kind: "error", message: errorMessage(e) });
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
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
    } finally {
      setExporting(null);
    }
  };

  const report = state.kind === "ready" ? state.report : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            aria-label="Back to portfolio"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-semibold">Fit/Gap Report</h1>
        </div>

        {portfolio && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={state.kind === "generating"}
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              Regenerate
            </Button>
            {report && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting}>
                  {exporting === "pdf" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="mr-1 h-3.5 w-3.5" />
                  )}
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!!exporting}>
                  {exporting === "json" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
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

      {state.kind === "loading" && (
        <div className="space-y-4" role="status" aria-label="Loading report">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {state.kind === "error" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" aria-hidden />
          <p className="mt-3 font-medium">This report could not be loaded</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{state.message}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={retry}>
            Try again
          </Button>
        </div>
      )}

      {state.kind === "empty" && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <FileQuestion className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">No portfolio for this session yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            A fit/gap report compares a completed portfolio against a vacancy. Once
            this session ends and its portfolio finishes generating, the comparison
            will appear here.
          </p>
        </div>
      )}

      {state.kind === "generating" && (
        <div className="rounded-lg border p-12 text-center" role="status">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">Generating fit/gap report…</p>
        </div>
      )}

      {state.kind === "timed_out" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" aria-hidden />
          <p className="mt-3 font-medium">This is taking longer than expected</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            The report has not arrived after two minutes, which usually means the
            background job failed. Nothing has been lost — you can try again.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={retry}>
            Check again
          </Button>
        </div>
      )}

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
              <CardTitle className="text-sm">Culture &amp; Competency Fit</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {report.narrative_status === "failed" ? (
                // Previously the page rendered culture_narrative || overall_narrative,
                // so the rule-based fallback appeared under this heading as though it
                // were an analysis. Say what happened instead.
                <div className="rounded border border-amber-200 bg-amber-50 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                    Narrative unavailable
                  </p>
                  <p className="mt-1 text-sm text-amber-800">
                    The written analysis could not be generated for this report. The
                    skill comparison above is rule-based and unaffected.
                  </p>
                  {report.overall_narrative && (
                    <p className="mt-2 text-xs text-amber-800/80">{report.overall_narrative}</p>
                  )}
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {report.culture_narrative ?? report.overall_narrative}
                </p>
              )}
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
                      <div key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{s.skill_label}</span>
                        <span className="text-muted-foreground">
                          {s.ai_level != null ? LEVEL_LABELS[s.ai_level] : "not assessed"}
                        </span>
                        {s.ai_confidence && (
                          <span className="text-xs text-muted-foreground">
                            {s.ai_confidence} confidence
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          — not required for this role, may be additive.
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
