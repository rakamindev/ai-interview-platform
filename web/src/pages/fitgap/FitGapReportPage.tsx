
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Code2,
  Download,
  FileJson,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { usePolling } from "@/hooks/usePolling";

import type {
  FitGapReport,
  Portfolio,
  Vacancy,
} from "@/types";

type ReportStatus =
  | "loading"
  | "generating"
  | "ready"
  | "error";

type ExportFormat = "pdf" | "json";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const numericSessionId = Number(sessionId);
  const numericVacancyId = Number(vacancyId);

  const [portfolio, setPortfolio] =
    useState<Portfolio | null>(null);

  const [vacancy, setVacancy] =
    useState<Vacancy | null>(null);

  const [report, setReport] =
    useState<FitGapReport | null>(null);

  const [status, setStatus] =
    useState<ReportStatus>("loading");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [vacancyError, setVacancyError] =
    useState(false);

  const [pollError, setPollError] =
    useState(false);

  const [regenerating, setRegenerating] =
    useState(false);

  const [exporting, setExporting] =
    useState<ExportFormat | null>(null);

  const [exportError, setExportError] =
    useState(false);

  const requestInProgress = useRef(false);

  const portfolioUrl =
    `/assessments/${id}/sessions/${sessionId}/portfolio`;

  const transcriptUrl =
    `/assessments/${id}/sessions/${sessionId}/transcript`;

  const fetchReport = useCallback(
    async (portfolioId: number) => {
      if (requestInProgress.current) {
        return;
      }

      requestInProgress.current = true;

      try {
        const response =
          await portfoliosApi.getFitGap(
            portfolioId,
            numericVacancyId
          );

        setReport(response.data.report);
        setStatus("ready");
        setPollError(false);
        setErrorMessage("");
      } catch (error) {
        if (
          axios.isAxiosError(error) &&
          error.response?.status === 404
        ) {
          setStatus("generating");
        } else {
          console.error(
            "Failed to fetch fit/gap report:",
            error
          );

          setPollError(true);
        }
      } finally {
        requestInProgress.current = false;
      }
    },
    [numericVacancyId]
  );

  const loadPage = useCallback(async () => {
    setStatus("loading");
    setErrorMessage("");
    setVacancyError(false);
    setPollError(false);
    setReport(null);

    if (
      !Number.isInteger(numericSessionId) ||
      numericSessionId <= 0 ||
      !Number.isInteger(numericVacancyId) ||
      numericVacancyId <= 0
    ) {
      setErrorMessage(
        "The session or vacancy ID is invalid."
      );
      setStatus("error");
      return;
    }

    const [portfolioResult, vacancyResult] =
      await Promise.allSettled([
        sessionsApi.getPortfolio(
          numericSessionId
        ),
        vacanciesApi.get(
          numericVacancyId
        ),
      ]);

    if (vacancyResult.status === "fulfilled") {
      setVacancy(
        vacancyResult.value.data.vacancy
      );
    } else {
      console.error(
        "Failed to load vacancy:",
        vacancyResult.reason
      );

      setVacancyError(true);
    }

    if (portfolioResult.status === "rejected") {
      console.error(
        "Failed to load portfolio:",
        portfolioResult.reason
      );

      setErrorMessage(
        "The candidate portfolio could not be loaded."
      );
      setStatus("error");
      return;
    }

    const portfolioData =
      portfolioResult.value.data;

    if (
      !("portfolio" in portfolioData) ||
      !portfolioData.portfolio
    ) {
      setErrorMessage(
        "The candidate portfolio is not available yet."
      );
      setStatus("error");
      return;
    }

    const loadedPortfolio =
      portfolioData.portfolio;

    setPortfolio(loadedPortfolio);

    try {
      const response =
        await portfoliosApi.getFitGap(
          loadedPortfolio.id,
          numericVacancyId
        );

      setReport(response.data.report);
      setStatus("ready");
    } catch (error) {
      if (
        !axios.isAxiosError(error) ||
        error.response?.status !== 404
      ) {
        console.error(
          "Failed to load fit/gap report:",
          error
        );

        setErrorMessage(
          "The fit/gap report could not be loaded."
        );
        setStatus("error");
        return;
      }

      try {
        setStatus("generating");

        const response =
          await portfoliosApi.triggerFitGap(
            loadedPortfolio.id,
            numericVacancyId
          );

        if ("report" in response.data) {
          setReport(response.data.report);
          setStatus("ready");
        }
      } catch (triggerError) {
        console.error(
          "Failed to generate fit/gap report:",
          triggerError
        );

        setErrorMessage(
          "Report generation could not be started."
        );
        setStatus("error");
      }
    }
  }, [numericSessionId, numericVacancyId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const pollReport = useCallback(async () => {
    if (!portfolio) {
      return;
    }

    await fetchReport(portfolio.id);
  }, [portfolio, fetchReport]);

  usePolling(
    pollReport,
    5000,
    status === "generating" && portfolio !== null
  );

  const handleRegenerate = async () => {
    if (!portfolio || regenerating) {
      return;
    }

    setRegenerating(true);
    setErrorMessage("");
    setPollError(false);

    try {
      await portfoliosApi.regenerateFitGap(
        portfolio.id,
        numericVacancyId
      );

      setReport(null);
      setStatus("generating");
    } catch (error) {
      console.error(
        "Failed to regenerate fit/gap report:",
        error
      );

      setErrorMessage(
        "Unable to restart report generation. Please try again."
      );
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (
    format: ExportFormat
  ) => {
    if (!portfolio || !report || exporting) {
      return;
    }

    setExporting(format);
    setExportError(false);

    try {
      const response =
        await portfoliosApi.exportPortfolio(
          portfolio.id,
          format,
          numericVacancyId
        );

      const blob =
        format === "json"
          ? new Blob(
              [
                JSON.stringify(
                  response.data,
                  null,
                  2
                ),
              ],
              {
                type: "application/json",
              }
            )
          : response.data instanceof Blob
            ? response.data
            : new Blob(
                [
                  response.data as BlobPart,
                ],
                {
                  type: "application/pdf",
                }
              );

      downloadBlob(
        blob,
        `fitgap-${sessionId}-${vacancyId}.${format}`
      );
    } catch (error) {
      console.error(
        "Failed to export fit/gap report:",
        error
      );

      setExportError(true);
    } finally {
      setExporting(null);
    }
  };

  const comparisons =
    report?.skill_comparisons ?? [];

  const matchCount = comparisons.filter(
    (item) => item.result === "match"
  ).length;

  const gapCount = comparisons.filter(
    (item) => item.result === "gap"
  ).length;

  const exceedCount = comparisons.filter(
    (item) => item.result === "exceed"
  ).length;

  const notAssessedCount = comparisons.filter(
    (item) => item.result === "not_assessed"
  ).length;

  const discoveredSkills =
    portfolio?.skills.filter(
      (skill) => skill.is_discovered
    ) ?? [];

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-6xl space-y-7">
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-5 w-64" />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>

        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-10">
      <header className="space-y-5">
        <Link
          to={portfolioUrl}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portfolio
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-primary">
              Competency Assessment
            </p>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Fit/Gap Report
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Compare the candidate's competencies
              with the requirements of a vacancy.
            </p>

            {vacancy && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-semibold text-primary">
                <Target className="h-4 w-4" />
                {vacancy.role_title}
              </div>
            )}

            {vacancyError && (
              <p className="mt-3 text-xs text-amber-700">
                Vacancy details could not be loaded.
                The report remains available.
              </p>
            )}
          </div>

          {portfolio && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  void handleRegenerate();
                }}
                disabled={
                  regenerating ||
                  status === "generating"
                }
              >
                {regenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}

                Regenerate
              </Button>

              {status === "ready" && (
                <>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={exporting !== null}
                    onClick={() => {
                      void handleExport("pdf");
                    }}
                  >
                    {exporting === "pdf" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}

                    Export PDF
                  </Button>

                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={exporting !== null}
                    onClick={() => {
                      void handleExport("json");
                    }}
                  >
                    {exporting === "json" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileJson className="mr-2 h-4 w-4" />
                    )}

                    JSON
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">
              Something went wrong
            </p>

            <p className="mt-1 text-sm leading-6 text-red-700">
              {errorMessage}
            </p>

            {status === "error" && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 border-red-200 bg-white"
                onClick={() => {
                  void loadPage();
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            )}
          </div>
        </div>
      )}

      {exportError && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          The report could not be exported.
          Please try again.
        </div>
      )}

      {status === "generating" && (
        <section className="rounded-2xl border border-primary/20 bg-white p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>

          <h2 className="mt-6 text-xl font-bold text-slate-900">
            Generating Fit/Gap Report
          </h2>

          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
            The candidate's assessed competencies
            are being compared with the selected
            vacancy's requirements.
          </p>

          <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <RefreshCw className="h-4 w-4 text-primary" />
            Checking for updates every 5 seconds
          </div>

          {pollError && (
            <div className="mx-auto mt-5 max-w-md rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs leading-5 text-amber-800">
                The latest report status could not
                be retrieved.
              </p>

              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => {
                  void pollReport();
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Check Now
              </Button>
            </div>
          )}
        </section>
      )}

      {status === "ready" && report && (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-slate-500">
                  Requirements Met
                </p>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>

              <p className="mt-4 text-2xl font-bold text-slate-900">
                {matchCount + exceedCount}
                <span className="ml-1 text-base font-medium text-slate-400">
                  / {comparisons.length}
                </span>
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Skills meeting or exceeding
                the expected level
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-slate-500">
                  Skill Gaps
                </p>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Target className="h-5 w-5" />
                </div>
              </div>

              <p className="mt-4 text-2xl font-bold text-slate-900">
                {gapCount}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Skills below the vacancy's
                expected level
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-slate-500">
                  Above Expectations
                </p>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>

              <p className="mt-4 text-2xl font-bold text-slate-900">
                {exceedCount}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Skills exceeding the required level
              </p>
            </div>
          </section>

          <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <Code2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />

            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Comparison Complete
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-600">
                Review the skill-level comparisons and
                supporting narratives below. The report
                reflects the available portfolio findings
                and vacancy requirements.
              </p>

              {notAssessedCount > 0 && (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  {notAssessedCount}{" "}
                  {notAssessedCount === 1
                    ? "skill was"
                    : "skills were"}{" "}
                  not assessed.
                </p>
              )}
            </div>
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ClipboardList className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Skill Comparison
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Expected levels compared with
                    the candidate's assessed levels.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {comparisons.length > 0 ? (
                <ComparisonTable
                  comparisons={comparisons}
                />
              ) : (
                <div className="py-10 text-center">
                  <ClipboardList className="mx-auto h-9 w-9 text-slate-300" />

                  <p className="mt-3 text-sm text-slate-500">
                    No skill comparisons are available.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <Target className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Culture &amp; Competency Fit
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    AI-generated assessment narrative
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {report.culture_narrative ||
                  report.overall_narrative ||
                  "No narrative is available for this report."}
              </p>
            </div>
          </section>

          {report.culture_narrative &&
            report.overall_narrative &&
            report.culture_narrative !==
              report.overall_narrative && (
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5 sm:p-6">
                  <h2 className="text-lg font-bold text-slate-900">
                    Overall Assessment
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Summary of the comparison findings
                  </p>
                </div>

                <div className="p-5 sm:p-6">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {report.overall_narrative}
                  </p>
                </div>
              </section>
            )}

          {discoveredSkills.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Zap className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Discovered Skills
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Additional competencies identified
                      during the interview.
                    </p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-slate-100 px-5 sm:px-6">
                {discoveredSkills.map((skill) => (
                  <div
                    key={skill.id}
                    className="flex flex-wrap items-start justify-between gap-4 py-5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {skill.skill_label}
                      </p>

                      {skill.competency_summary && (
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          {skill.competency_summary}
                        </p>
                      )}

                      <p className="mt-2 text-xs text-slate-400">
                        Additional finding outside
                        the configured assessment skills
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {skill.ai_level}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          skill.ai_confidence.toLowerCase() ===
                          "low"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {skill.ai_confidence} confidence
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Review the Interview Evidence
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Return to the portfolio or inspect
                the full interview transcript.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                asChild
                className="rounded-xl"
              >
                <Link to={transcriptUrl}>
                  <FileText className="mr-2 h-4 w-4" />
                  Transcript
                </Link>
              </Button>

              <Button
                asChild
                className="rounded-xl"
              >
                <Link to={portfolioUrl}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Portfolio
                </Link>
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}