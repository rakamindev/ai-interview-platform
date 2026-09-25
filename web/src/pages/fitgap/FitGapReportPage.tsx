import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserRoundCheck,
  Zap,
} from "lucide-react";
import { fitGapResponseState, hasCompletedFitGapReport, summarizeFitGap } from "@/lib/fitGap";
import type { FitGapReport, Portfolio } from "@/types";

interface SummaryCardProps {
  label: string;
  value: number;
  helper: string;
  icon: React.ReactNode;
}

function SummaryCard({ label, value, helper, icon }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2 text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
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
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationRequestedRef = useRef(false);

  const requestGeneration = useCallback(async () => {
    if (!portfolio || generationRequestedRef.current) return;

    generationRequestedRef.current = true;
    setError(null);
    try {
      const response = await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
      if (hasCompletedFitGapReport(response.data)) {
        setReport(response.data.report);
        setGenerating(false);
        return;
      }
      setGenerating(fitGapResponseState(response.data) === "generating");
    } catch (requestError: any) {
      generationRequestedRef.current = false;
      setGenerating(false);
      setError(
        requestError?.response?.data?.message ??
          "The fit/gap analysis could not be started. Please try again."
      );
    }
  }, [portfolio, vacancyId]);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;

    try {
      const response = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      if (hasCompletedFitGapReport(response.data)) {
        setReport(response.data.report);
        setGenerating(false);
        setError(null);
        return;
      }

      const state = fitGapResponseState(response.data);
      setGenerating(state === "generating");
      if (state === "failed") {
        setError(response.data.message);
      }
    } catch (fetchError: any) {
      if (fetchError?.response?.status === 404) {
        await requestGeneration();
        return;
      }

      setGenerating(false);
      setError(
        fetchError?.response?.data?.message ??
          "The fit/gap report could not be loaded. Please try again."
      );
    }
  }, [portfolio, vacancyId, requestGeneration]);

  useEffect(() => {
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then((response) => {
        const data = response.data as any;
        if (data.portfolio) setPortfolio(data.portfolio);
      })
      .catch(() => setError("The candidate portfolio could not be loaded."))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (portfolio) fetchReport();
  }, [portfolio, fetchReport]);

  usePolling(fetchReport, 5000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio) return;

    setRegenerating(true);
    setError(null);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      generationRequestedRef.current = true;
      setReport(null);
      setGenerating(true);
    } catch (regenerateError: any) {
      setError(
        regenerateError?.response?.data?.message ??
          "The fit/gap analysis could not be regenerated."
      );
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    try {
      const response = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
      const blob = format === "pdf"
        ? new Blob([response.data as BlobPart], { type: "application/pdf" })
        : new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `fitgap-${sessionId}-${vacancyId}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const comparisons = report?.skill_comparisons ?? [];
  const summary = summarizeFitGap(comparisons);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Back to portfolio"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-semibold tracking-tight">Fit / Gap Decision Support</h1>
          </div>
          <p className="pl-7 text-sm text-muted-foreground">
            Compare role expectations with interview evidence without turning unknowns into negative signals.
          </p>
        </div>

        {portfolio && (
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || generating}>
              {regenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
              )}
              Regenerate
            </Button>
            {report && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting}>
                  {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!!exporting}>
                  {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                  JSON
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
              <div>
                <p className="text-sm font-medium">Analysis unavailable</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || !portfolio}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry analysis
            </Button>
          </div>
        </div>
      )}

      {generating && !report && !error && (
        <div className="rounded-xl border bg-muted/20 p-10 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 text-sm font-medium">Building an evidence-grounded fit/gap report</p>
          <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
            Skill comparisons are deterministic. The narrative is generated separately and the page will refresh automatically.
          </p>
        </div>
      )}

      {report && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Matches"
              value={summary.match}
              helper="Meets the configured level"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <SummaryCard
              label="Exceeds"
              value={summary.exceed}
              helper="Evidence above the requirement"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <SummaryCard
              label="Gaps"
              value={summary.gap}
              helper="Observed level below requirement"
              icon={<TrendingDown className="h-4 w-4" />}
            />
            <SummaryCard
              label="Unknown"
              value={summary.not_assessed}
              helper="Required skills not assessed"
              icon={<CircleHelp className="h-4 w-4" />}
            />
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-blue-950">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Human decision remains in the loop</p>
                <p className="text-sm text-blue-900/80">
                  “Not assessed” means unknown, not a gap. Low-confidence ratings should be verified before they influence a hiring decision.
                  {summary.lowConfidence > 0 && ` ${summary.lowConfidence} comparison${summary.lowConfidence === 1 ? "" : "s"} currently need extra caution.`}
                  {summary.overrides > 0 && ` ${summary.overrides} result${summary.overrides === 1 ? " uses" : "s use"} an assessor override.`}
                </p>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Skill-by-skill comparison</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ComparisonTable comparisons={comparisons} />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  Overall evidence summary
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {report.overall_narrative || "No overall narrative was produced. Use the structured skill comparison above."}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <UserRoundCheck className="h-4 w-4 text-muted-foreground" />
                  Culture & competency context
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {report.culture_narrative || "No culture narrative was produced. Avoid inferring culture fit without supporting evidence."}
                </p>
              </CardContent>
            </Card>
          </div>

          {portfolio?.skills.some((skill) => skill.is_discovered) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Discovered skills outside the vacancy requirements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4">
                {portfolio.skills
                  .filter((skill) => skill.is_discovered)
                  .map((skill) => (
                    <div key={skill.id} className="flex flex-col gap-1 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <span className="font-medium">{skill.skill_label}</span>
                        <p className="text-xs text-muted-foreground">Not included in the vacancy comparison.</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        L{String(skill.ai_level).replace(/\D/g, "")} · {skill.ai_confidence} confidence
                      </span>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          <p className="text-right text-xs text-muted-foreground">
            Generated {new Date(report.generated_at).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}
