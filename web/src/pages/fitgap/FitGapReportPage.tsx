import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import StatePanel from "@/components/portfolio/StatePanel";
import ExpandableText from "@/components/portfolio/ExpandableText";
import LevelBadge from "@/components/portfolio/LevelBadge";
import ConfidenceIndicator from "@/components/portfolio/ConfidenceIndicator";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { usePolling } from "@/hooks/usePolling";
import { summarizeComparisons, toLevel } from "@/lib/portfolio";
import { ArrowLeft, CircleDashed, Download, Info, Loader2, RefreshCw, TriangleAlert, Zap } from "lucide-react";
import type { FitGapReport, Portfolio } from "@/types";

/** Give up polling after this many attempts (5 s apart) and offer a retry. */
const MAX_POLLS = 36;

type LoadState = "loading" | "error" | "not_ready" | "ready";

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{ id: string; sessionId: string; vacancyId: string }>();

  const [load, setLoad] = useState<LoadState>("loading");
  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [roleTitle, setRoleTitle] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [polls, setPolls] = useState(0);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
    } catch (e: any) {
      if (e?.response?.status !== 404) {
        setActionError("Couldn't load the report. It will retry automatically.");
        return;
      }
      if (!generating) {
        // Not generated yet: ask once, then poll. The API dedupes repeat requests.
        await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
        setGenerating(true);
      }
      setPolls((n) => n + 1);
    }
  }, [portfolio, vacancyId, generating]);

  const loadPage = useCallback(() => {
    setLoad("loading");
    setActionError(null);
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then((res) => {
        const data = res.data as { portfolio?: Portfolio };
        if (data.portfolio?.generation_status === "complete") {
          setPortfolio(data.portfolio);
          setLoad("ready");
        } else {
          setLoad("not_ready");
        }
      })
      .catch(() => setLoad("error"));
    vacanciesApi
      .get(Number(vacancyId))
      .then((r) => setRoleTitle(r.data.vacancy.role_title))
      .catch(() => setRoleTitle(null));
  }, [sessionId, vacancyId]);

  useEffect(loadPage, [loadPage]);

  useEffect(() => {
    if (portfolio) fetchReport().catch(() => setLoad("error"));
    // Run once per loaded portfolio; polling takes over from there.
  }, [portfolio]); // fetchReport deliberately omitted: it changes when `generating` flips

  const timedOut = generating && polls >= MAX_POLLS;
  usePolling(() => fetchReport().catch(() => undefined), 5000, generating && !!portfolio && !timedOut);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    setActionError(null);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      setPolls(0);
      setGenerating(true);
    } catch {
      setActionError("Couldn't start regeneration. Try again.");
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
    } catch {
      setActionError(`Couldn't export the ${format.toUpperCase()}. Try again.`);
    } finally {
      setExporting(null);
    }
  };

  const backTo = `/assessments/${id}/sessions/${sessionId}/portfolio`;
  const discovered = portfolio?.skills.filter((s) => s.is_discovered) ?? [];
  const counts = report ? summarizeComparisons(report.skill_comparisons) : null;

  if (load === "loading") {
    return (
      <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <Link to={backTo} className="mt-1 rounded-sm text-muted-foreground hover:text-foreground" aria-label="Back to portfolio">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">Fit/gap report</h1>
            {roleTitle && <p className="truncate text-sm text-muted-foreground">Against: {roleTitle}</p>}
          </div>
        </div>

        {load === "ready" && (
          <div className="flex flex-wrap gap-2 pl-6 sm:pl-0">
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || (generating && !timedOut)}>
              {regenerating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
              Regenerate
            </Button>
            {report && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting}>
                  {exporting === "pdf" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!!exporting}>
                  {exporting === "json" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                  JSON
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {actionError && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      )}

      {load === "error" && (
        <StatePanel
          tone="error"
          icon={<TriangleAlert className="h-7 w-7" />}
          title="We couldn't load this report"
          action={
            <Button variant="outline" size="sm" onClick={loadPage}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try again
            </Button>
          }
        />
      )}

      {load === "not_ready" && (
        <StatePanel
          icon={<CircleDashed className="h-7 w-7" />}
          title="The portfolio isn't ready yet"
          action={
            <Button variant="outline" size="sm" asChild>
              <Link to={backTo}>Back to portfolio</Link>
            </Button>
          }
        >
          A fit/gap report compares the finished skill portfolio against the vacancy. Come back once it has been
          generated.
        </StatePanel>
      )}

      {generating && !timedOut && (
        <StatePanel icon={<Loader2 className="h-7 w-7 animate-spin" />} title="Comparing against the vacancy…">
          Levels are compared by rule; only the written summary uses AI. This usually takes a few seconds.
        </StatePanel>
      )}

      {timedOut && (
        <StatePanel tone="error" icon={<TriangleAlert className="h-7 w-7" />} title="The report is taking too long">
          Use Regenerate to try again. If it keeps failing, the background worker may be down.
        </StatePanel>
      )}

      {report && counts && (
        <>
          {counts.notAssessed > 0 && (
            <div className="flex gap-2 rounded-lg border border-dashed px-4 py-3 text-sm">
              <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <p>
                <span className="font-medium">
                  {counts.notAssessed} of {report.skill_comparisons.length} required skills weren't assessed.
                </span>{" "}
                <span className="text-muted-foreground">
                  There's no evidence either way — schedule a follow-up or add your own rating on the portfolio before
                  deciding.
                </span>
              </p>
            </div>
          )}

          <Card className="shadow-sm">
            <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3">
              <CardTitle className="text-sm">Skill comparison</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          {(report.culture_narrative || report.overall_narrative) && (
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-2">
                <CardTitle className="text-sm">Summary</CardTitle>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Info className="h-3 w-3" aria-hidden /> Written by AI from the comparison above. Not a hiring
                  recommendation.
                </p>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
                {report.culture_narrative && (
                  <ExpandableText text={report.culture_narrative} className="text-sm leading-relaxed" />
                )}
                {report.overall_narrative && (
                  <ExpandableText text={report.overall_narrative} className="text-sm leading-relaxed" />
                )}
              </CardContent>
            </Card>
          )}

          {discovered.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <Zap className="h-4 w-4 text-amber-500" aria-hidden />
                  Also came up in the interview
                </CardTitle>
                <p className="text-xs text-muted-foreground">Not required by this vacancy. Briefly explored, so treat as a signal only.</p>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4 sm:px-5 sm:pb-5">
                {discovered.map((s) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <LevelBadge level={toLevel(s.ai_level)} size="sm" />
                    <span className="min-w-0 flex-1 text-sm font-medium break-words">{s.skill_label}</span>
                    <ConfidenceIndicator confidence={s.ai_confidence} />
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
