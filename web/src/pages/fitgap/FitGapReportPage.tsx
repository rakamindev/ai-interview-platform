import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import FitGapSummary from "@/components/fitgap/FitGapSummary";
import SkillVerdictRow from "@/components/fitgap/SkillVerdictRow";
import { useFitGapReport } from "@/hooks/useFitGapReport";
import { summarize } from "@/lib/fitGap";
import { portfoliosApi } from "@/services/portfolios";
import { vacanciesApi } from "@/services/vacancies";
import { parseLevel } from "@/utils/constants";
import { AlertCircle, ArrowLeft, Clock, Download, Loader2, RefreshCw, Scale } from "lucide-react";

const LONG_TEXT = 420;

function Narrative({ title, text }: { title: string; text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > LONG_TEXT;

  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      <p className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${long && !expanded ? "line-clamp-5" : ""}`}>
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function StateCard({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 rounded-lg border px-6 py-12 text-center">
      {icon}
      <p className="text-sm font-medium">{title}</p>
      {children}
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{ id: string; sessionId: string; vacancyId: string }>();
  const { phase, report, portfolio, updating, regenerate, retry } = useFitGapReport(Number(sessionId), Number(vacancyId));

  const [roleTitle, setRoleTitle] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [exportFailed, setExportFailed] = useState(false);

  useEffect(() => {
    vacanciesApi.get(Number(vacancyId))
      .then((res) => setRoleTitle(res.data.vacancy.role_title))
      .catch(() => setRoleTitle(null));
  }, [vacancyId]);

  const comparisons = report?.skill_comparisons ?? [];
  const summary = useMemo(() => summarize(comparisons), [comparisons]);
  const portfolioPath = `/assessments/${id}/sessions/${sessionId}/portfolio`;
  const discovered = portfolio?.skills.filter((s) => s.is_discovered) ?? [];
  const firstToReview = comparisons.find((c) => c.result === "insufficient_evidence" && c.portfolio_skill_id);
  const canExport = phase === "ready" && !!report;

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setExportFailed(false);
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
      setExportFailed(true);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <Link to={portfolioPath} aria-label="Back to portfolio" className="mt-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">Fit/Gap Report</h1>
            <p className="break-words text-sm text-muted-foreground">
              {roleTitle ?? "Vacancy"}
              {report && phase === "ready" && (
                <> · Updated {new Date(report.generated_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</>
              )}
            </p>
          </div>
        </div>

        {portfolio && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={regenerate} disabled={phase === "generating" || phase === "loading"}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Regenerate
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!canExport || !!exporting}>
              {exporting === "pdf" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!canExport || !!exporting}>
              {exporting === "json" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
              JSON
            </Button>
          </div>
        )}
      </div>

      {exportFailed && (
        <p role="alert" className="text-sm text-destructive">The export could not be created. Please try again.</p>
      )}

      {/* States without a report to show */}
      {!report && (phase === "loading" || phase === "generating") && (
        <div className="space-y-3">
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {phase === "loading" ? "Loading report…" : "Comparing the portfolio with this role's requirements. This usually takes under a minute."}
          </p>
          <ReportSkeleton />
        </div>
      )}

      {phase === "portfolio_not_ready" && (
        <StateCard icon={<Clock className="h-8 w-8 text-muted-foreground" />} title="The skill portfolio for this session is not ready yet.">
          <p className="max-w-sm text-sm text-muted-foreground">The fit/gap report is built from the portfolio. Check the portfolio page for its status.</p>
          <Button asChild variant="outline" size="sm"><Link to={portfolioPath}>Go to portfolio</Link></Button>
        </StateCard>
      )}

      {phase === "slow" && (
        <StateCard icon={<Clock className="h-8 w-8 text-muted-foreground" />} title="This is taking longer than usual.">
          <p className="max-w-sm text-sm text-muted-foreground">The report is still being prepared. You can check again now or come back later.</p>
          <Button size="sm" onClick={retry}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Check again</Button>
        </StateCard>
      )}

      {phase === "error" && (
        <StateCard icon={<AlertCircle className="h-8 w-8 text-destructive" />} title="We couldn't load the report.">
          <p className="max-w-sm text-sm text-muted-foreground">Check your connection and try again.</p>
          <Button size="sm" onClick={retry}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Try again</Button>
        </StateCard>
      )}

      {/* Report */}
      {report && (phase === "ready" || phase === "generating") && (
        <div aria-busy={updating} className="space-y-6">
          {updating && (
            <p role="status" className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Updating with the latest ratings. The previous result is shown until then.
            </p>
          )}

          <div className={updating ? "pointer-events-none space-y-6 opacity-60" : "space-y-6"}>
            {comparisons.length === 0 ? (
              <StateCard icon={<Scale className="h-8 w-8 text-muted-foreground" />} title="This vacancy has no skill requirements yet.">
                <p className="max-w-sm text-sm text-muted-foreground">Add the skills and expected levels for this role to compare candidates against it.</p>
                <Button asChild variant="outline" size="sm"><Link to={`/vacancies/${vacancyId}/edit`}>Add requirements</Link></Button>
              </StateCard>
            ) : (
              <>
                <FitGapSummary summary={summary} />

                {summary.review > 0 && firstToReview && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    <p className="font-medium">
                      {summary.review === 1 ? "1 skill needs" : `${summary.review} skills need`} your review before this report is complete.
                    </p>
                    <p className="mt-0.5 text-amber-900">
                      The interview touched {summary.review === 1 ? "it" : "them"} too briefly to rate reliably, so {summary.review === 1 ? "it is" : "they are"} not counted as a gap or a strength.
                      Confirming a level on the portfolio updates this report.
                    </p>
                  </div>
                )}

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Skills required for this role</CardTitle>
                    <p className="text-xs text-muted-foreground">Ordered by what needs a decision first. The outlined step is the expected level.</p>
                  </CardHeader>
                  <CardContent>
                    <ul className="divide-y">
                      {comparisons.map((c) => (
                        <SkillVerdictRow
                          key={c.skill_label}
                          comparison={c}
                          reviewHref={
                            c.result === "insufficient_evidence" && c.portfolio_skill_id
                              ? `${portfolioPath}#skill-${c.portfolio_skill_id}`
                              : undefined
                          }
                        />
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </>
            )}

            {(report.overall_narrative || report.culture_narrative) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Summary</CardTitle>
                  <p className="text-xs text-muted-foreground">Generated from the verdicts above, which are rule-based. It does not re-rate any skill.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {report.overall_narrative && <Narrative title="Overall" text={report.overall_narrative} />}
                  {report.culture_narrative && <Narrative title="Culture & competency" text={report.culture_narrative} />}
                </CardContent>
              </Card>
            )}

            {discovered.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Also observed</CardTitle>
                  <p className="text-xs text-muted-foreground">Skills that came up in the interview but are not required for this role.</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {discovered.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                        <span className="break-words font-medium">{s.skill_label}</span>
                        <span className="text-xs text-muted-foreground">
                          L{parseLevel(s.ai_level)} · {s.ai_confidence?.toLowerCase() === "low" ? "briefly explored" : `${s.ai_confidence} confidence`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <p className="text-xs leading-relaxed text-muted-foreground">
              A skill is only marked below expected when the interview produced enough evidence or an assessor confirmed the level.
              This report supports a hiring decision; it does not make one.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
