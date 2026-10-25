import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { extractApiError } from "@/lib/apiErrors";
import { getComparisonResult } from "@/utils/fitGap";
import { portfolioKeys, sessionKeys, vacancyKeys } from "@/lib/queryKeys";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Download,
  Loader2,
  RefreshCw,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();
  const numericSessionId = Number(sessionId);
  const numericVacancyId = Number(vacancyId);
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [pendingStaleExport, setPendingStaleExport] = useState<"pdf" | "json" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const portfolioQuery = useQuery({
    queryKey: sessionKeys.portfolio(numericSessionId),
    queryFn: async () => {
      const data = (await sessionsApi.getPortfolio(numericSessionId)).data;
      if (!("portfolio" in data)) throw new Error("The candidate portfolio is not ready yet.");
      return data.portfolio;
    },
  });
  const vacancyQuery = useQuery({
    queryKey: vacancyKeys.detail(numericVacancyId),
    queryFn: async () => (await vacanciesApi.get(numericVacancyId)).data.vacancy,
  });
  const sessionQuery = useQuery({
    queryKey: sessionKeys.detail(numericSessionId),
    queryFn: async () => (await sessionsApi.get(numericSessionId)).data,
  });
  const portfolio = portfolioQuery.data ?? null;
  const vacancy = vacancyQuery.data ?? null;
  const candidateName = sessionQuery.data?.session.candidate_name ?? null;

  const reportQuery = useQuery({
    queryKey: portfolioKeys.fitGap(portfolio?.id ?? 0, numericVacancyId),
    enabled: Boolean(portfolio),
    queryFn: async () => {
      try {
        return (await portfoliosApi.getFitGap(portfolio!.id, numericVacancyId)).data.report;
      } catch (error) {
        if (extractApiError(error).status !== 404) throw error;
        const response = await portfoliosApi.triggerFitGap(portfolio!.id, numericVacancyId);
        if ("report" in response.data) return response.data.report;
        return null;
      }
    },
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const report = reportQuery.data ?? null;

  useEffect(() => {
    if (!portfolio) return;
    const refetchOnFocus = () => void reportQuery.refetch();
    window.addEventListener("focus", refetchOnFocus);
    return () => window.removeEventListener("focus", refetchOnFocus);
  }, [portfolio, reportQuery.refetch]);

  const regenerateMutation = useMutation({
    mutationFn: () => portfoliosApi.regenerateFitGap(portfolio!.id, numericVacancyId),
    onSuccess: (response) => {
      queryClient.setQueryData(
        portfolioKeys.fitGap(portfolio!.id, numericVacancyId),
        response.data.report
      );
    },
  });

  const handleRegenerate = () => {
    if (portfolio) regenerateMutation.mutate();
  };

  const handleExport = async (format: "pdf" | "json", allowStale = false) => {
    if (!portfolio) return;
    if (report?.freshness === "failed" && !allowStale) {
      setPendingStaleExport(format);
      return;
    }
    setExportError(null);
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId), allowStale);
      const ext = format;
      const blob = format === "pdf"
        ? new Blob([res.data as BlobPart], { type: "application/pdf" })
        : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitgap-${sessionId}-${vacancyId}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Export is unavailable until this report is current.");
    } finally {
      setExporting(null);
      setPendingStaleExport(null);
    }
  };

  const hasCompletedReport = report?.has_completed_report ?? false;
  const initialGeneration = report?.freshness === "updating" && !hasCompletedReport;
  const exportBlocked = !report || !hasCompletedReport || report.freshness === "updating" || report.freshness === "outdated";
  const assessedComparisons =
    report?.skill_comparisons.filter(
      (comparison) => getComparisonResult(comparison) !== "not_assessed"
    ) ?? [];
  const meetsOrExceedsCount = assessedComparisons.filter(
    (comparison) => {
      const result = getComparisonResult(comparison);
      return result === "match" || result === "exceed";
    }
  ).length;
  const gapCount = assessedComparisons.filter(
    (comparison) => getComparisonResult(comparison) === "gap"
  ).length;
  const notAssessedCount =
    report?.skill_comparisons.filter(
      (comparison) => getComparisonResult(comparison) === "not_assessed"
    ).length ?? 0;
  const roleFitPercentage =
    assessedComparisons.length === 0
      ? null
      : Math.round((meetsOrExceedsCount / assessedComparisons.length) * 100);

  const freshnessPresentation = report && {
    current: {
      label: "Current",
      message: "This report reflects the latest vacancy and rating inputs.",
      className: "border-green-200 bg-green-50 text-green-800",
    },
    updating: {
      label: "Updating",
      message: hasCompletedReport
        ? "Inputs changed. The previous report remains visible while a replacement is generated."
        : "Generating the first report for these inputs.",
      className: "border-amber-200 bg-amber-50 text-amber-900",
    },
    outdated: {
      label: "Outdated",
      message: "This report does not match the latest inputs. Regenerate it before relying on the result.",
      className: "border-amber-200 bg-amber-50 text-amber-900",
    },
    failed: {
      label: "Update failed",
      message: report.generation_error || "The previous report is still available, but it is not current.",
      className: "border-red-200 bg-red-50 text-red-800",
    },
  }[report.freshness];

  const loading = portfolioQuery.isPending || vacancyQuery.isPending || sessionQuery.isPending;
  const loadError = portfolioQuery.error || vacancyQuery.error || sessionQuery.error;
  const reportError = reportQuery.error || regenerateMutation.error;
  const reportLoading = reportQuery.isPending;

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl">
        <div
          role="alert"
          className="space-y-3 rounded-lg border border-destructive/40 p-10 text-center"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-base font-semibold">Couldn't load this Fit/Gap report</h1>
            <p className="mt-1 break-words text-sm text-muted-foreground">{extractApiError(loadError).message}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={() =>
                void Promise.all([
                  portfolioQuery.refetch(),
                  vacancyQuery.refetch(),
                  sessionQuery.refetch(),
                ])
              }
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Retry
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/assessments/${id}/sessions/${sessionId}/portfolio`}>
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Back to portfolio
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            aria-label="Back to portfolio"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div className="min-w-0 pt-1">
            <h1 className="text-lg font-semibold">Fit/Gap Report</h1>
            {(candidateName || vacancy) && (
              <p className="break-words text-sm text-muted-foreground">
                {[candidateName, vacancy?.role_title].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>

        {portfolio && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerateMutation.isPending || report?.freshness === "updating"}>
              {regenerateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Regenerate
            </Button>
            {report && hasCompletedReport && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting || exportBlocked}>
                  {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!!exporting || exportBlocked}>
                  {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                  JSON
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {report && freshnessPresentation && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${freshnessPresentation.className}`} role="status">
          <div className="flex flex-wrap items-center gap-2">
            {report.freshness === "current" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <span className="font-semibold">{freshnessPresentation.label}</span>
            {report.generated_at && (
              <span className="text-xs opacity-80">Generated {new Date(report.generated_at).toLocaleString()}</span>
            )}
          </div>
          <p className="mt-1">{freshnessPresentation.message}</p>
        </div>
      )}

      {exportError && <p className="text-sm text-destructive" role="alert">{exportError}</p>}

      {reportError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-red-900">Couldn't update the Fit/Gap report</p>
            <p className="mt-0.5 break-words text-xs text-red-800/80">{extractApiError(reportError).message}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 bg-background"
            onClick={() => {
              regenerateMutation.reset();
              void reportQuery.refetch();
            }}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Retry
          </Button>
        </div>
      )}

      {/* Generating */}
      {(reportLoading || initialGeneration || (!report && !reportError)) && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Generating Fit/Gap report…</p>
        </div>
      )}

      {/* Report ready */}
      {report && hasCompletedReport && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Fit/Gap summary">
            <div
              aria-label={`Role fit estimate: ${roleFitPercentage ?? "not available"}`}
              className="rounded-lg border border-violet-200 bg-violet-50 p-3.5"
            >
              <div className="flex items-center gap-2 text-violet-700">
                <Target className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wide">Role fit</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-violet-950">
                {roleFitPercentage === null ? "—" : `${roleFitPercentage}%`}
              </p>
              <p className="mt-1 text-xs text-violet-800/75">
                {meetsOrExceedsCount} of {assessedComparisons.length} assessed requirements
              </p>
            </div>
            <div
              aria-label={`Meets or exceeds: ${meetsOrExceedsCount}`}
              className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5"
            >
              <div className="flex items-center gap-2 text-emerald-700">
                <TrendingUp className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wide">Meets / exceeds</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-950">
                {meetsOrExceedsCount}
              </p>
              <p className="mt-1 text-xs text-emerald-800/75">At or above vacancy level</p>
            </div>
            <div
              aria-label={`Skill gaps: ${gapCount}`}
              className="rounded-lg border border-amber-200 bg-amber-50 p-3.5"
            >
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wide">Skill gaps</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-amber-950">{gapCount}</p>
              <p className="mt-1 text-xs text-amber-800/75">
                {notAssessedCount > 0 ? `${notAssessedCount} not assessed` : "All requirements assessed"}
              </p>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-3">
              Role fit is the share of assessed vacancy requirements that the candidate meets or
              exceeds. It excludes unassessed skills and is not a hiring decision.
            </p>
          </div>

          {/* Skill comparison */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Skill Comparison</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          <Separator />

          {/* Culture & competency */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Culture &amp; Competency Fit</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {report.culture_narrative || report.overall_narrative}
              </p>
            </CardContent>
          </Card>

          {/* Discovered skills */}
          {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
            <>
              <Separator />
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Discovered Skills (not in vacancy requirements)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {portfolio.skills
                    .filter((s) => s.is_discovered)
                    .map((s) => (
                      <div key={s.id} className="text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium">{s.skill_label}</span>
                        <span className="text-muted-foreground">
                          {s.ai_level} ({s.ai_confidence?.toLowerCase() === "low" ? "low confidence" : "confirmed"})
                        </span>
                        <span className="text-xs text-muted-foreground">— Not required for this role, may be additive.</span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      <AlertDialog open={pendingStaleExport !== null} onOpenChange={(open) => !open && setPendingStaleExport(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export an outdated report?</AlertDialogTitle>
            <AlertDialogDescription>
              Regeneration failed. This export will be clearly marked stale and may not reflect the latest vacancy or assessor rating.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingStaleExport && handleExport(pendingStaleExport, true)}
            >
              Export stale report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
