import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Bot,
  Download,
  FileWarning,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { usePolling } from "@/hooks/usePolling";
import { summarizeComparisons } from "@/lib/fitGap";
import type { FitGapReport, Portfolio, Vacancy } from "@/types";

function SummaryMetric({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "emerald" | "amber" | "teal";
}) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-900",
    emerald: "border-emerald-200 bg-emerald-50/70 text-emerald-900",
    amber: "border-amber-200 bg-amber-50/70 text-amber-950",
    teal: "border-teal-200 bg-teal-50/70 text-teal-900",
  };

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
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
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;

    try {
      const response = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      const nextReport = response.data.report;
      setReport(nextReport);
      setGenerating(
        nextReport.generation_status === "pending" ||
          nextReport.generation_status === "generating",
      );
      setRequestError(null);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        try {
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          setGenerating(true);
          setRequestError(null);
        } catch {
          setGenerating(false);
          setRequestError("We could not start this comparison. Please try again.");
        }
        return;
      }

      setGenerating(false);
      setRequestError("We could not refresh this report. Check your connection and try again.");
    }
  }, [portfolio, vacancyId]);

  useEffect(() => {
    Promise.all([
      sessionsApi.getPortfolio(Number(sessionId)),
      sessionsApi.get(Number(sessionId)),
      vacanciesApi.get(Number(vacancyId)),
    ])
      .then(([portfolioResponse, sessionResponse, vacancyResponse]) => {
        const data = portfolioResponse.data as { portfolio?: Portfolio };
        if (!data.portfolio) {
          setRequestError("The candidate portfolio is not ready for comparison.");
          return;
        }

        setPortfolio(data.portfolio);
        setCandidateName(sessionResponse.data.session.candidate_name ?? null);
        setVacancy(vacancyResponse.data.vacancy);
      })
      .catch(() => {
        setRequestError("We could not load this candidate review.");
      })
      .finally(() => setLoading(false));
  }, [sessionId, vacancyId]);

  useEffect(() => {
    if (portfolio) void fetchReport();
  }, [portfolio, fetchReport]);

  usePolling(fetchReport, 3000, generating && !!portfolio);

  const reviewSummary = useMemo(() => {
    if (!report) return null;
    return report.review_summary ?? summarizeComparisons(report.skill_comparisons);
  }, [report]);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    setRequestError(null);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      setGenerating(true);
    } catch {
      setRequestError("Regeneration could not be started. Please try again.");
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setRequestError(null);
    try {
      const response = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        Number(vacancyId),
      );
      const blob =
        format === "pdf"
          ? new Blob([response.data as BlobPart], { type: "application/pdf" })
          : new Blob([JSON.stringify(response.data, null, 2)], {
              type: "application/json",
            });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `fitgap-${sessionId}-${vacancyId}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setRequestError(`The ${format.toUpperCase()} export could not be created.`);
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  const failed = report?.generation_status === "failed";
  const ready = report?.generation_status === "complete";

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to portfolio
          </Link>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Evidence review
          </div>
          <h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            {vacancy?.role_title ?? "Fit / gap report"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {candidateName ? `${candidateName} · ` : ""}
            AI-assisted comparison for assessor review
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerating || generating || !portfolio}
          >
            {regenerating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Re-run
          </Button>
          {ready && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
              >
                {exporting === "pdf" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-3.5 w-3.5" />
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
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                )}
                JSON
              </Button>
            </>
          )}
        </div>
      </header>

      {requestError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{requestError}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => void fetchReport()}>
            Try again
          </Button>
        </div>
      )}

      {generating && (
        <div
          aria-live="polite"
          className="overflow-hidden rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-8 text-center sm:p-12"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-teal-100">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
          </div>
          <h2 className="mt-4 font-semibold text-slate-900">Comparing role requirements with interview evidence</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-600">
            The skill comparison is deterministic. AI is only drafting the contextual narrative,
            and this page will flag missing or low-confidence evidence for human review.
          </p>
        </div>
      )}

      {failed && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <FileWarning className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-amber-950">Report generation stopped safely</h2>
              <p className="mt-1 text-sm leading-relaxed text-amber-900/80">
                {report?.generation_error ??
                  "The comparison could not be completed. No partial report will be used for a hiring decision."}
              </p>
              <Button className="mt-4" size="sm" onClick={handleRegenerate} disabled={regenerating}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Try generation again
              </Button>
            </div>
          </div>
        </div>
      )}

      {ready && report && reviewSummary && (
        <>
          <section
            className={
              reviewSummary.decision_status === "review_required"
                ? "rounded-2xl border border-amber-200 bg-amber-50 p-5"
                : "rounded-2xl border border-emerald-200 bg-emerald-50 p-5"
            }
          >
            <div className="flex items-start gap-3">
              {reviewSummary.decision_status === "review_required" ? (
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
              ) : (
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
              )}
              <div>
                <h2 className="font-semibold text-slate-950">
                  {reviewSummary.decision_status === "review_required"
                    ? "Human review required before this report informs a decision"
                    : "Evidence is ready for structured human review"}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">
                  {reviewSummary.decision_status === "review_required"
                    ? `${reviewSummary.not_assessed} unassessed and ${reviewSummary.low_confidence} low-confidence requirement(s) need follow-up. Absence of evidence is not evidence of a skill gap.`
                    : "Every required skill has usable evidence. Validate quotes and context before recording a hiring outcome."}
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="summary-title">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">At a glance</p>
                <h2 id="summary-title" className="mt-1 text-lg font-semibold text-slate-950">Requirement coverage</h2>
              </div>
              <p className="text-xs text-slate-500">{reviewSummary.total_skills} required skills</p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <SummaryMetric label="Meets" value={reviewSummary.match} tone="emerald" />
              <SummaryMetric label="Above" value={reviewSummary.exceed} tone="teal" />
              <SummaryMetric label="Below" value={reviewSummary.gap} tone="amber" />
              <SummaryMetric label="Not assessed" value={reviewSummary.not_assessed} />
            </div>
          </section>

          <section aria-labelledby="comparison-title">
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Traceable evidence</p>
              <h2 id="comparison-title" className="mt-1 text-lg font-semibold text-slate-950">Skill-by-skill comparison</h2>
            </div>
            <ComparisonTable comparisons={report.skill_comparisons} />
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Contextual synthesis
                </div>
                <h2 className="mt-2 text-lg font-semibold text-slate-950">Culture and competency context</h2>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                  {report.culture_narrative ||
                    report.overall_narrative ||
                    "No narrative was generated. Use the structured comparison above for review."}
                </p>
              </CardContent>
            </Card>

            <aside className="rounded-xl border border-blue-200 bg-blue-50 p-5">
              <div className="flex items-center gap-2 text-blue-900">
                <Bot className="h-5 w-5" aria-hidden="true" />
                <h2 className="font-semibold">AI use boundary</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-blue-900/80">
                AI drafts the narrative and evidence ratings. It does not make, rank, or approve
                a hiring decision. Review the transcript, evidence quotes, confidence, and any
                assessor overrides before acting.
              </p>
            </aside>
          </div>

          {portfolio?.skills.some((skill) => skill.is_discovered) && (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="font-semibold text-slate-950">Additional signals, outside role requirements</h2>
              <p className="mt-1 text-sm text-slate-600">
                These skills were mentioned during the interview but are not scored as role fit.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {portfolio.skills
                  .filter((skill) => skill.is_discovered)
                  .map((skill) => (
                    <span
                      key={skill.id}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
                    >
                      {skill.skill_label} · {skill.ai_level} · {skill.ai_confidence} confidence
                    </span>
                  ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
