import { useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import FitGapSummary from "@/components/fitgap/FitGapSummary";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { useFitGapReport } from "@/hooks/useFitGapReport";
import { summarize } from "@/lib/fitgap";
import { LEVEL_LABELS, parseLevel } from "@/utils/constants";
import { AlertCircle, ArrowLeft, Download, Info, Loader2, RefreshCw, Zap } from "lucide-react";
import type { Portfolio } from "@/types";

type PortfolioState = "loading" | "ready" | "pending" | "error";

function Notice({ tone, children }: { tone: "info" | "warn" | "error"; children: ReactNode }) {
  const styles = {
    info: "border-border bg-muted/40 text-muted-foreground",
    warn: "border-amber-300 bg-amber-50 text-amber-800",
    error: "border-destructive/40 bg-destructive/5 text-destructive",
  }[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${styles}`}
    >
      {tone === "error" ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{ id: string; sessionId: string; vacancyId: string }>();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [portfolioState, setPortfolioState] = useState<PortfolioState>("loading");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [exportError, setExportError] = useState(false);
  const [regenerateError, setRegenerateError] = useState(false);

  const loadPortfolio = useCallback(() => {
    setPortfolioState("loading");
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then((res) => {
        const data = res.data as { portfolio?: Portfolio };
        if (data.portfolio && data.portfolio.generation_status === "complete") {
          setPortfolio(data.portfolio);
          setPortfolioState("ready");
        } else {
          setPortfolioState("pending");
        }
      })
      .catch(() => setPortfolioState("error"));
  }, [sessionId]);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  const { report, state, timedOut, retrying, reload, regenerate } = useFitGapReport(
    portfolio?.id,
    Number(vacancyId)
  );

  const handleRegenerate = async () => {
    setRegenerateError(false);
    if (!(await regenerate())) setRegenerateError(true);
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setExportError(false);
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
    } catch {
      setExportError(true);
    } finally {
      setExporting(null);
    }
  };

  const header = (
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
      {report && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={retrying || report.narrative_status === "pending"}
          >
            {retrying ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
            )}
            Rewrite summary
          </Button>
          {(["pdf", "json"] as const).map((f) => (
            <Button key={f} variant="outline" size="sm" onClick={() => handleExport(f)} disabled={!!exporting}>
              {exporting === f ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-1 h-3.5 w-3.5" />
              )}
              {f.toUpperCase()}
            </Button>
          ))}
        </div>
      )}
    </div>
  );

  const shell = (body: ReactNode) => (
    <div className="mx-auto max-w-3xl space-y-5">
      {header}
      {body}
    </div>
  );

  if (portfolioState === "loading" || (portfolioState === "ready" && state === "loading" && !report)) {
    return shell(
      <div className="space-y-4" aria-busy="true" aria-label="Loading fit/gap report">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (portfolioState === "error") {
    return shell(
      <Notice tone="error">
        <p>We couldn't load this candidate's portfolio.</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={loadPortfolio}>
          Try again
        </Button>
      </Notice>
    );
  }

  if (portfolioState === "pending") {
    return shell(
      <Notice tone="info">
        <p>The skill portfolio is not ready yet, so there is nothing to compare against the vacancy.</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={loadPortfolio}>
          Check again
        </Button>
      </Notice>
    );
  }

  if (state === "not_ready") {
    return shell(<Notice tone="info">The portfolio is still being finalised. Please try again in a moment.</Notice>);
  }

  if (state === "error" || !report) {
    return shell(
      <Notice tone="error">
        <p>We couldn't build the fit/gap report. The vacancy may have been removed, or the server is unavailable.</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={reload}>
          Try again
        </Button>
      </Notice>
    );
  }

  const summary = report.summary ?? summarize(report.skill_comparisons);
  const discovered = portfolio?.skills.filter((s) => s.is_discovered) ?? [];
  const nothingAssessed = summary.total > 0 && summary.assessed === 0;

  return shell(
    <>
      {exportError && <Notice tone="error">Export failed. Please try again.</Notice>}
      {regenerateError && <Notice tone="error">Couldn't restart the summary. Please try again.</Notice>}

      <Card>
        <CardContent className="p-4">
          <FitGapSummary summary={summary} />
        </CardContent>
      </Card>

      {nothingAssessed && (
        <Notice tone="warn">
          None of the required skills were assessed in this interview, so no comparison is possible. This says nothing
          about the candidate's ability.
        </Notice>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Skill Comparison</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ComparisonTable comparisons={report.skill_comparisons} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            Summary
            {report.narrative_status === "pending" && !timedOut && (
              <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Updating…
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
          {report.narrative_status === "failed" && (
            <Notice tone="warn">
              The written summary could not be generated, so a factual overview is shown instead. The table above is
              unaffected.
            </Notice>
          )}
          {report.narrative_status === "pending" && timedOut && (
            <Notice tone="warn">Writing the summary is taking longer than expected. The table above is up to date.</Notice>
          )}
          {report.culture_narrative && (
            <section>
              <h2 className="mb-1 text-xs font-medium text-muted-foreground">Culture &amp; competency fit</h2>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{report.culture_narrative}</p>
            </section>
          )}
          {report.overall_narrative && (
            <section>
              <h2 className="mb-1 text-xs font-medium text-muted-foreground">Overall</h2>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{report.overall_narrative}</p>
            </section>
          )}
          {!report.culture_narrative && !report.overall_narrative && report.narrative_status !== "pending" && (
            <p className="text-sm text-muted-foreground">No written summary for this report.</p>
          )}
          <p className="text-xs text-muted-foreground">
            This report supports a human decision; it does not make one. Levels come from an AI reading of the
            interview and can be adjusted by an assessor.
          </p>
        </CardContent>
      </Card>

      {discovered.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Zap className="h-4 w-4 text-amber-500" aria-hidden /> Additional skills (not required for this role)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4">
            {discovered.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-x-2 text-sm">
                <span className="break-words font-medium">{s.skill_label}</span>
                <span className="text-muted-foreground">
                  {LEVEL_LABELS[parseLevel(s.ai_level)] ?? "—"} ·{" "}
                  {s.ai_confidence?.toLowerCase() === "low" ? "limited evidence" : "confirmed"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
