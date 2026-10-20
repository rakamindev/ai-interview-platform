import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import LevelBadge from "@/components/portfolio/LevelBadge";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { usePolling } from "@/hooks/usePolling";
import { parseLevel, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Zap,
  AlertCircle,
  Clock,
  Info,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import type { FitGapReport, Portfolio } from "@/types";

const MAX_POLL_ATTEMPTS = 12;

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [vacancyTitle, setVacancyTitle] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [isStaleRefresh, setIsStaleRefresh] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [failedError, setFailedError] = useState<string | null>(null);
  const [notFoundError, setNotFoundError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const pollAttemptsRef = useRef(0);
  const hasTriggeredRef = useRef<string | null>(null);
  const latestRequestIdRef = useRef(0);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    const targetVacancyId = Number(vacancyId);
    const triggerKey = `${portfolio.id}:${targetVacancyId}`;
    const requestId = ++latestRequestIdRef.current;

    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, targetVacancyId);
      if (requestId !== latestRequestIdRef.current) return;

      const data = res.data;
      setNotFoundError(null);

      if (data.status === "ready" && data.report) {
        pollAttemptsRef.current = 0;
        setReport(data.report);
        setGenerating(false);
        setIsStaleRefresh(false);
        setTimedOut(false);
        setFailedError(null);
        return;
      }

      if (data.status === "failed") {
        setGenerating(false);
        setIsStaleRefresh(false);
        setTimedOut(false);
        setFailedError(
          data.message ?? "Fit/Gap report generation failed. Please retry generation."
        );
        return;
      }

      if (data.status === "generating") {
        setIsStaleRefresh(!!data.stale);
        pollAttemptsRef.current += 1;
        if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
          setGenerating(false);
          setTimedOut(true);
        } else {
          setGenerating(true);
          setTimedOut(false);
          setFailedError(null);
        }
        return;
      }

      if (data.status === "not_generated") {
        if (hasTriggeredRef.current !== triggerKey) {
          hasTriggeredRef.current = triggerKey;
          pollAttemptsRef.current = 0;
          setGenerating(true);
          setTimedOut(false);
          setFailedError(null);
          try {
            const triggerRes = await portfoliosApi.triggerFitGap(portfolio.id, targetVacancyId);
            if (requestId !== latestRequestIdRef.current) return;
            if (triggerRes.data?.status === "ready" && triggerRes.data?.report) {
              setReport(triggerRes.data.report);
              setGenerating(false);
            }
          } catch (triggerErr: unknown) {
            if (requestId !== latestRequestIdRef.current) return;
            const triggerStatus = (triggerErr as { response?: { status?: number } })?.response?.status;
            setGenerating(false);
            if (triggerStatus === 404) {
              setNotFoundError("The requested portfolio or vacancy could not be found in your workspace.");
            } else {
              setFailedError("Could not start Fit/Gap report generation. Please retry.");
            }
          }
        } else {
          setGenerating(true);
        }
      }
    } catch (e: unknown) {
      if (requestId !== latestRequestIdRef.current) return;
      const status = (e as { response?: { status?: number } })?.response?.status;
      setGenerating(false);
      setTimedOut(false);
      if (status === 404) {
        // 404 is terminal: parent portfolio or vacancy does not exist in tenant scope.
        // Never auto-trigger POST /fitgap on 404.
        setNotFoundError("The requested portfolio or vacancy was not found in your workspace.");
      } else {
        setFailedError("Unable to load Fit/Gap report status. Please try again.");
      }
    }
  }, [portfolio, vacancyId]);

  useEffect(() => {
    setLoading(true);
    setNotFoundError(null);
    setFailedError(null);
    Promise.all([
      sessionsApi.getPortfolio(Number(sessionId)),
      vacanciesApi.list().catch(() => null),
    ])
      .then(([res, vRes]) => {
        const data = res.data;
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        } else {
          setNotFoundError("Portfolio is not ready yet for this session.");
        }
        const matchedVacancy = vRes?.data?.vacancies?.find(
          (v) => v.id === Number(vacancyId)
        );
        if (matchedVacancy) {
          setVacancyTitle(matchedVacancy.role_title);
        }
      })
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          setNotFoundError("Session or portfolio was not found in your workspace.");
        } else {
          setFailedError("Unable to load candidate portfolio.");
        }
      })
      .finally(() => setLoading(false));
  }, [sessionId, vacancyId]);

  useEffect(() => {
    if (portfolio) {
      pollAttemptsRef.current = 0;
      fetchReport();
    }
  }, [portfolio, fetchReport]);

  usePolling(fetchReport, 5000, generating && !timedOut && !!portfolio);

  const handleCheckStatusNow = async () => {
    pollAttemptsRef.current = 0;
    setTimedOut(false);
    await fetchReport();
  };

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    setFailedError(null);
    setTimedOut(false);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      pollAttemptsRef.current = 0;
      setReport(null);
      setGenerating(true);
      toast.info("Regenerating vacancy alignment report...", "Fit/Gap Report");
    } catch {
      setGenerating(false);
      setFailedError("Failed to trigger Fit/Gap regeneration. Please try again.");
      toast.error("Failed to trigger Fit/Gap regeneration.", "Error");
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
      const ext = format;
      const blob =
        format === "pdf"
          ? new Blob([res.data as BlobPart], { type: "application/pdf" })
          : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitgap-${sessionId}-${vacancyId}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Fit/Gap report downloaded as ${format.toUpperCase()}!`, "Export Complete");
    } catch {
      toast.error("Export failed. Please try again.", "Export Error");
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading Fit/Gap report"
        className="w-full space-y-4"
      >
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const candidateName = portfolio?.session_summary?.candidate_name ?? null;
  const comparisons = report?.skill_comparisons ?? [];
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;
  const totalRequiredCount = comparisons.length;

  return (
    <div className="w-full space-y-6 pb-10">
      {/* Header card: Report heading, vacancy context & actions */}
      <div className="rounded-[10px] border border-[#E2E8F0] bg-white p-4 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            aria-label="Back to candidate portfolio"
            className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F7F9FA] hover:text-[#1F2937] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium text-[#64748B]">
              Vacancy Alignment Analysis
            </p>
            <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight text-[#1F2937] leading-tight">
              Fit/Gap Report
            </h1>
            {(candidateName || vacancyTitle) && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-[#64748B]">
                {candidateName && (
                  <span className="font-medium text-[#1F2937] break-words">
                    {candidateName}
                  </span>
                )}
                {candidateName && vacancyTitle && <span aria-hidden="true">→</span>}
                {vacancyTitle && (
                  <span className="font-semibold text-[#0B7479] break-words">
                    {vacancyTitle}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {portfolio && !notFoundError && (
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating || generating}
            >
              {regenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1 text-[#64748B]" />
              )}
              Regenerate
            </Button>
            {report && !generating && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("pdf")}
                  disabled={!!exporting}
                >
                  {exporting === "pdf" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1 text-[#64748B]" />
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
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1 text-[#64748B]" />
                  )}
                  JSON
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Terminal 404 / Not Found state */}
      {notFoundError && (
        <div role="alert" className="border border-destructive/40 bg-white rounded-[10px] p-6 text-center space-y-3">
          <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
          <p className="text-sm font-medium text-destructive">{notFoundError}</p>
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="inline-flex items-center text-xs underline text-[#64748B] hover:text-[#1F2937]"
          >
            Return to portfolio
          </Link>
        </div>
      )}

      {/* Generating */}
      {generating && !timedOut && !notFoundError && (
        <div role="status" aria-live="polite" className="border border-[#E2E8F0] rounded-[10px] bg-white p-8 sm:p-10 text-center space-y-3">
          <Loader2 className="h-7 w-7 animate-spin text-[#0F8F95] mx-auto" />
          <div className="space-y-1">
            <p className="font-semibold text-[#1F2937] text-sm">Generating fit/gap report...</p>
            {isStaleRefresh && (
              <p className="text-xs text-[#64748B]">
                Refreshing comparison and narrative after a recent assessor override.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Polling Timeout (role="status": not a confirmed backend failure) */}
      {timedOut && !notFoundError && (
        <div
          role="status"
          aria-live="polite"
          className="border border-amber-300 bg-amber-50/70 rounded-[10px] p-6 text-center space-y-3"
        >
          <Clock className="h-6 w-6 text-amber-600 mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-900">
              Fit/Gap report analysis is still processing in the background
            </p>
            <p className="text-xs text-amber-800 max-w-xl mx-auto leading-relaxed">
              Automatic status polling has paused because generation is taking longer than usual. You can check the latest status without queueing a duplicate job, or restart generation.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={handleCheckStatusNow}>
              Check Status
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              {regenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Restart Generation
            </Button>
          </div>
        </div>
      )}

      {/* Failed state */}
      {!generating && !timedOut && !notFoundError && failedError && (
        <div role="alert" className="border border-destructive/40 bg-white rounded-[10px] p-6 text-center space-y-3">
          <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
          <p className="text-sm font-medium text-destructive">{failedError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerating}
          >
            {regenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Retry Generation
          </Button>
        </div>
      )}

      {/* Report ready */}
      {!generating && !timedOut && !notFoundError && !failedError && report && (
        <>
          {/* Partial Coverage Caveat when unassessed skills exist */}
          {notAssessedCount > 0 && (
            <div
              role="note"
              aria-label="Partial interview coverage notice"
              className="flex items-start gap-2.5 rounded-[10px] border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-amber-900"
            >
              <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="leading-relaxed">
                <span className="font-semibold">Partial coverage note:</span>{" "}
                {notAssessedCount} of {totalRequiredCount} required role skill
                {totalRequiredCount !== 1 ? "s" : ""} lacked sufficient interview turns (0–1 probes) and{" "}
                {notAssessedCount === 1 ? "is" : "are"} marked{" "}
                <span className="font-semibold">Not assessed</span> rather than penalized as a confirmed skill gap.
              </p>
            </div>
          )}

          {/* 1. Main Detailed Evidence Area: Skill Comparison Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[18px] sm:text-[20px] font-semibold text-[#1F2937]">
                Skill Comparison
              </CardTitle>
              <p className="text-[13px] text-[#64748B]">
                Direct comparison of required role proficiency levels against candidate ratings and assessor overrides.
              </p>
            </CardHeader>
            <CardContent>
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          {/* 2. Separate Readable Narrative Sections: Overall & Culture Fit */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {report.overall_narrative && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-[#1F2937]">
                    Overall Hiring Recommendation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[14px] sm:text-[15px] leading-relaxed text-[#1F2937] whitespace-pre-wrap break-words">
                    {report.overall_narrative}
                  </p>
                </CardContent>
              </Card>
            )}

            <Card className={!report.overall_narrative ? "lg:col-span-2" : undefined}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-[#1F2937]">
                  Culture &amp; Competency Fit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[14px] sm:text-[15px] leading-relaxed text-[#1F2937] whitespace-pre-wrap break-words">
                  {report.culture_narrative || "No separate culture narrative was generated for this report."}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 3. Discovered skills (outside vacancy requirements) */}
          {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
            <>
              <Separator className="bg-[#E2E8F0]" />
              <Card>
                <CardHeader className="pb-2.5">
                  <CardTitle className="text-base font-semibold text-[#1F2937] flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" aria-hidden="true" />
                    Discovered Skills (not in vacancy requirements)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {portfolio.skills
                    .filter((s) => s.is_discovered)
                    .map((s) => {
                      const override = portfolio.overrides.find(
                        (o) => o.portfolio_skill_id === s.id
                      );
                      const effectiveLevel =
                        override?.override_level ?? parseLevel(s.ai_level);
                      return (
                        <div
                          key={s.id}
                          className="text-sm flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-[#F7F9FA] px-3.5 py-2.5"
                        >
                          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                            <span className="font-semibold text-[#1F2937] break-words">
                              {s.skill_label}
                            </span>
                            <LevelBadge level={effectiveLevel} size="sm" />
                            {LEVEL_DESCRIPTIONS[effectiveLevel] && (
                              <span className="text-xs text-[#64748B]">
                                ({LEVEL_DESCRIPTIONS[effectiveLevel]})
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-[#64748B]">
                            {override
                              ? `Human override applied (AI L${parseLevel(s.ai_level)} → L${effectiveLevel})`
                              : s.ai_confidence?.toLowerCase() === "low"
                              ? "Low AI confidence"
                              : "Assessed outside role rubric"}
                          </span>
                        </div>
                      );
                    })}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}



