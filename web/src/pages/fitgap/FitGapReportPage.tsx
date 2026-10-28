import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import LevelBadge from "@/components/portfolio/LevelBadge";
import { downloadPortfolioExport } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { useFitGapReport } from "@/hooks/useFitGapReport";
import { apiErrorMessage } from "@/lib/apiError";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap } from "lucide-react";
import type { Portfolio } from "@/types";

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{ id: string; sessionId: string; vacancyId: string }>();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const { report, phase, error, regenerate, retry } = useFitGapReport(portfolio?.id ?? null, Number(vacancyId));

  useEffect(() => {
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then((res) => {
        const data = res.data as { portfolio?: Portfolio };
        if (data.portfolio?.generation_status === "complete") setPortfolio(data.portfolio);
        else setPortfolioError("The portfolio is not ready yet. Fit/gap needs a finished portfolio.");
      })
      .catch((e) => setPortfolioError(apiErrorMessage(e, "Could not load the portfolio.")));
  }, [sessionId]);

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setExportError(null);
    try {
      await downloadPortfolioExport(portfolio.id, format, `fitgap-${sessionId}-${vacancyId}.${format}`, Number(vacancyId));
    } catch (e) {
      setExportError((e as Error).message);
    } finally {
      setExporting(null);
    }
  };

  const backLink = `/assessments/${id}/sessions/${sessionId}/portfolio`;
  const discovered = portfolio?.skills.filter((s) => s.is_discovered) ?? [];
  const loading = !portfolioError && (!portfolio || phase === "loading");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link to={backLink} className="text-muted-foreground hover:text-foreground" aria-label="Back to portfolio">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-semibold">Fit/Gap Report</h1>
        </div>

        {report && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={regenerate} disabled={phase === "generating"}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Regenerate
            </Button>
            {(["pdf", "json"] as const).map((format) => (
              <Button key={format} variant="outline" size="sm" onClick={() => handleExport(format)} disabled={!!exporting}>
                {exporting === format ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1" />
                )}
                {format.toUpperCase()}
              </Button>
            ))}
          </div>
        )}
      </div>

      {portfolioError && (
        <Notice tone="error" action={<Link to={backLink} className="text-sm underline">Back to portfolio</Link>}>
          {portfolioError}
        </Notice>
      )}

      {exportError && <Notice tone="error">{exportError}</Notice>}

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {phase === "error" && (
        <Notice tone="error" action={<Button size="sm" variant="outline" onClick={retry}>Try again</Button>}>
          {error}
        </Notice>
      )}

      {phase === "generating" && !report && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Comparing the portfolio against this vacancy…</p>
        </div>
      )}

      {report && (
        <>
          {phase === "generating" && (
            <Notice>Updating this report. The version below stays available until the new one is ready.</Notice>
          )}
          {phase !== "generating" && report.stale && (
            <Notice tone="warning" action={<Button size="sm" variant="outline" onClick={regenerate}>Regenerate</Button>}>
              Built with older scoring rules, which counted skills that were never discussed as gaps.
            </Notice>
          )}
          {phase !== "generating" && !report.stale && report.outdated && (
            <Notice tone="warning" action={<Button size="sm" variant="outline" onClick={regenerate}>Regenerate</Button>}>
              A rating was changed after this report was built.
            </Notice>
          )}

          <Card>
            <CardHeader className="px-4 pt-4 pb-3">
              <CardTitle className="text-sm">Skill comparison</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          {(report.culture_narrative || report.overall_narrative) && (
            <Card>
              <CardHeader className="px-4 pt-4 pb-3 space-y-1">
                <CardTitle className="text-sm">Summary</CardTitle>
                <p className="text-xs text-muted-foreground">AI-written draft. Check it against the evidence before sharing.</p>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-4 text-sm leading-relaxed">
                {report.culture_narrative && (
                  <section className="space-y-1">
                    <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Culture and competency fit</h2>
                    <p className="whitespace-pre-wrap break-words">{report.culture_narrative}</p>
                  </section>
                )}
                {report.overall_narrative && (
                  <section className="space-y-1">
                    <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Overall</h2>
                    <p className="whitespace-pre-wrap break-words">{report.overall_narrative}</p>
                  </section>
                )}
              </CardContent>
            </Card>
          )}

          {discovered.length > 0 && (
            <Card>
              <CardHeader className="px-4 pt-4 pb-3 space-y-1">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Discovered skills
                </CardTitle>
                <p className="text-xs text-muted-foreground">Came up in the interview but are not required for this vacancy.</p>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ul className="space-y-2">
                  {discovered.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-sm">
                      {s.ai_level != null ? (
                        <LevelBadge level={s.ai_level} size="sm" />
                      ) : (
                        <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5">Not rated</span>
                      )}
                      <span className="font-medium break-words">{s.skill_label}</span>
                      {s.ai_confidence === "low" && <span className="text-xs text-muted-foreground">provisional</span>}
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
