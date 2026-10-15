import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { useFitGapReport } from "@/hooks/useFitGapReport";
import { useElapsedSeconds } from "@/hooks/useElapsedSeconds";
import { downloadBlob } from "@/utils/download";
import { ArrowLeft, Download, Loader2, RefreshCw } from "lucide-react";
import type { Portfolio } from "@/types";

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{ id: string; sessionId: string; vacancyId: string }>();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [portfolioError, setPortfolioError] = useState(false);
  const [roleTitle, setRoleTitle] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [exportError, setExportError] = useState(false);

  const { state, retry, regenerate } = useFitGapReport(portfolio?.id ?? null, Number(vacancyId));
  const elapsed = useElapsedSeconds(state.status === "generating" ? state.startedAt : null);

  useEffect(() => {
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then((res) => {
        const data = res.data as { portfolio?: Portfolio };
        if (data.portfolio) setPortfolio(data.portfolio);
        else setPortfolioError(true);
      })
      .catch(() => setPortfolioError(true));
    vacanciesApi
      .get(Number(vacancyId))
      .then((res) => setRoleTitle(res.data.vacancy.role_title))
      .catch(() => setRoleTitle(null));
  }, [sessionId, vacancyId]);

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
      downloadBlob(blob, `fitgap-${sessionId}-${vacancyId}.${format}`);
    } catch {
      setExportError(true);
    } finally {
      setExporting(null);
    }
  };

  const report = state.status === "ready" ? state.report : null;
  const discovered = portfolio?.skills.filter((s) => s.is_discovered && s.ai_level != null) ?? [];
  const portfolioPath = `/assessments/${id}/sessions/${sessionId}/portfolio`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Link to={portfolioPath} aria-label="Back to portfolio" className="mt-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">Fit/gap report</h1>
            {roleTitle && <p className="break-words text-sm text-muted-foreground">Against {roleTitle}</p>}
          </div>
        </div>

        {report && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={regenerate}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Regenerate
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting}>
              {exporting === "pdf" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!!exporting}>
              {exporting === "json" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
              JSON
            </Button>
          </div>
        )}
      </header>

      {exportError && (
        <p role="alert" className="text-sm text-red-700">
          The export failed. Try again, or download JSON instead.
        </p>
      )}

      {portfolioError && (
        <div className="rounded-lg border p-6 text-sm">
          <p className="font-medium">The candidate's portfolio isn't ready.</p>
          <p className="mt-1 text-muted-foreground">
            A fit/gap report needs a finished portfolio. <Link to={portfolioPath} className="text-primary underline">Go to the portfolio</Link> to check its status.
          </p>
        </div>
      )}

      {!portfolioError && (state.status === "idle" || state.status === "loading") && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading report">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {state.status === "generating" && (
        <div role="status" className="space-y-2 rounded-lg border p-8 text-center">
          <Loader2 aria-hidden className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="font-medium">Comparing the portfolio with the role requirements</p>
          <p className="text-sm text-muted-foreground">Usually under 30 seconds. {elapsed}s so far.</p>
        </div>
      )}

      {(state.status === "timeout" || state.status === "error") && (
        <div role="alert" className="space-y-3 rounded-lg border border-red-200 p-6">
          <p className="font-medium text-red-800">
            {state.status === "timeout"
              ? "The report is taking longer than expected."
              : state.message}
          </p>
          <p className="text-sm text-muted-foreground">
            {state.status === "timeout"
              ? "The background job may have failed. Check again, or regenerate the report."
              : "Nothing was lost. You can try again."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={retry}>Check again</Button>
            <Button size="sm" variant="outline" onClick={regenerate}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Regenerate
            </Button>
          </div>
        </div>
      )}

      {report && (
        <>
          {report.stale && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm text-amber-900">
                Ratings or role requirements changed after this report was made, so it may be out of date.
              </p>
              <Button size="sm" onClick={regenerate}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Regenerate
              </Button>
            </div>
          )}

          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Skills against role requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          {(report.culture_narrative || report.overall_narrative) && (
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.culture_narrative && (
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{report.culture_narrative}</p>
                )}
                {report.overall_narrative && (
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{report.overall_narrative}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {report.culture_narrative
                    ? "Written by AI from the comparison above. Base decisions on the levels and evidence, not this text alone."
                    : "The AI summary was unavailable, so this was counted from the table above. Regenerate to try again."}
                </p>
              </CardContent>
            </Card>
          )}

          {discovered.length > 0 && (
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Other skills that came up</CardTitle>
                <p className="text-sm text-muted-foreground">Not required for this role. Possibly useful context.</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {discovered.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="break-words font-medium">{s.skill_label}</span>
                      <span className="text-muted-foreground">
                        L{s.ai_level}
                        {s.ai_confidence === "low" ? ", low confidence" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
