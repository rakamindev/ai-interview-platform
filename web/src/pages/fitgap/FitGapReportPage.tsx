import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import Breadcrumb from "@/components/layout/Breadcrumb";
import Page from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import LevelTrack from "@/components/assessment/LevelTrack";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, Download, Loader2, RefreshCw } from "lucide-react";
import type { FitGapReport, Portfolio } from "@/types";

type PageState = "loading" | "error" | "empty" | "generating" | "ready";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {children}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** Skeletons mirror the real layout so the page does not jump when data lands. */
function ReportSkeleton() {
  return (
    <div className="space-y-6" data-testid="report-skeleton">
      <div className="border-y bg-card px-5 py-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-5 w-64" />
        <Skeleton className="mt-2 h-3 w-80" />
      </div>
      <div className="border-t">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-6 border-b py-4 sm:grid-cols-3">
            <div>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
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
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
      setFailed(false);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        try {
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          setGenerating(true);
          setFailed(false);
        } catch {
          setGenerating(false);
          setFailed(true);
        }
      } else {
        setGenerating(false);
        setFailed(true);
      }
    }
  }, [portfolio, vacancyId]);

  const loadPortfolio = useCallback(() => {
    setLoading(true);
    setFailed(false);
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then((res) => {
        const data = res.data as any;
        setPortfolio(data.portfolio ?? null);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(loadPortfolio, [loadPortfolio]);

  useEffect(() => {
    if (portfolio) fetchReport();
  }, [portfolio, fetchReport]);

  usePolling(fetchReport, 5000, generating && !!portfolio);

  /* Quotes are matched by label because a comparison carries no skill id. An
     unmatched skill simply shows no quote — never a quote borrowed from
     another skill. */
  const evidenceByLabel = useMemo(() => {
    const map: Record<string, string> = {};
    portfolio?.skills.forEach((skill) => {
      const first = skill.evidence?.[0];
      if (first) map[skill.skill_label.toLowerCase()] = first;
    });
    return map;
  }, [portfolio]);

  const summary = useMemo(() => {
    const comparisons = report?.skill_comparisons ?? [];
    const count = (r: string) => comparisons.filter((c) => c.result === r).length;
    return {
      total: comparisons.length,
      met: count("match") + count("exceed"),
      gap: count("gap"),
      notAssessed: count("not_assessed"),
    };
  }, [report]);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      setGenerating(true);
    } catch {
      setFailed(true);
    } finally {
      setRegenerating(false);
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

  const state: PageState = loading
    ? "loading"
    : failed
    ? "error"
    : !portfolio
    ? "empty"
    : generating || !report
    ? "generating"
    : "ready";

  return (
    <Page width="board" className="space-y-6 px-1 pb-16">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Breadcrumb
            crumbs={[
              { label: "Assessments", to: "/assessments" },
              { label: "Candidates", to: `/assessments/${id}/invite` },
              { label: "Portfolio", to: `/assessments/${id}/sessions/${sessionId}/portfolio` },
              { label: "Fit / Gap" },
            ]}
          />
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight">Fit / Gap Report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            How this candidate's assessed skills line up with what the role asks for.
          </p>
        </div>

        {portfolio && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || generating}>
              {regenerating ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
              )}
              Regenerate
            </Button>
            {report && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting}>
                  {exporting === "pdf" ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="mr-1 h-3.5 w-3.5" />
                  )}
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!!exporting}>
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

      {state === "loading" && <ReportSkeleton />}

      {state === "error" && (
        <div className="border-l-2 border-destructive bg-card px-5 py-6">
          <h2 className="font-medium">This report could not be loaded</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            The comparison did not come back. The interview and its transcript are unaffected —
            nothing about the candidate's answers was lost.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={loadPortfolio}>
            Try again
          </Button>
        </div>
      )}

      {state === "empty" && (
        <div className="border border-dashed px-5 py-12 text-center">
          <h2 className="font-medium">No skill portfolio yet</h2>
          <p className="mx-auto mt-1 max-w-prose text-sm text-muted-foreground">
            A fit/gap report is built from the candidate's assessed skills. Once the interview is
            complete and the portfolio is generated, this comparison appears here.
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link to={`/assessments/${id}/sessions/${sessionId}/portfolio`}>Open portfolio</Link>
          </Button>
        </div>
      )}

      {state === "generating" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-l-2 border-primary bg-card px-4 py-3 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Comparing assessed skills against the role. This usually takes under a minute.</span>
          </div>
          <ReportSkeleton />
        </div>
      )}

      {state === "ready" && report && (
        <>
          <section className="border-t-2 border-t-primary border-b bg-card px-5 py-4">
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Skills compared
                </p>
                <p className="mt-1 font-mono text-sm tabular-nums">
                  {summary.met} met · {summary.gap} below · {summary.notAssessed} not assessed
                  <span className="text-muted-foreground"> of {summary.total}</span>
                </p>
              </div>
              {summary.notAssessed > 0 && (
                <p className="max-w-prose text-xs text-muted-foreground">
                  {summary.notAssessed} skill{summary.notAssessed === 1 ? " was" : "s were"} never
                  covered by the interview. Those are unknown, not weaknesses — a follow-up session
                  would be needed to judge them.
                </p>
              )}
            </div>
          </section>

          <section>
            <SectionLabel>Skill comparison</SectionLabel>
            <ComparisonTable
              comparisons={report.skill_comparisons}
              evidenceByLabel={evidenceByLabel}
            />
          </section>

          <section>
            <SectionLabel>Written assessment · generated by AI</SectionLabel>
            {report.culture_narrative || report.overall_narrative ? (
              <p className="max-w-prose whitespace-pre-wrap text-sm leading-relaxed">
                {report.culture_narrative || report.overall_narrative}
              </p>
            ) : (
              /* Partial: the comparison is ready before the narrative is. The page
                 shows what exists rather than blocking on the slowest part. */
              <div className="space-y-2" data-testid="narrative-pending">
                <Skeleton className="h-3 w-full max-w-prose" />
                <Skeleton className="h-3 w-4/5 max-w-prose" />
                <p className="pt-1 text-xs text-muted-foreground">
                  The written summary is still being generated.
                </p>
              </div>
            )}
          </section>

          {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
            <section>
              <SectionLabel>Found during the interview · not part of this role</SectionLabel>
              <div className="space-y-3">
                {portfolio.skills
                  .filter((s) => s.is_discovered)
                  .map((s) => (
                    <div key={s.id} className="flex flex-wrap items-center gap-3 border-b pb-3">
                      <span className="font-medium [overflow-wrap:anywhere]">{s.skill_label}</span>
                      <LevelTrack reached={s.ai_level} size="sm" />
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        L{s.ai_level}
                        {s.ai_confidence?.toLowerCase() === "low" && " · low confidence"}
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </>
      )}
    </Page>
  );
}
