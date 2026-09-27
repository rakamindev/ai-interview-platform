
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Save,
  ClipboardList,
  Code2,
  Download,
  FileJson,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";

import type {
  AssessorOverride,
  Portfolio,
  Vacancy,
  Session,
  HiringDecision,
} from "@/types";

type PortfolioViewStatus =
  | "loading"
  | "generating"
  | "complete"
  | "failed"
  | "unavailable";

type ExportFormat = "pdf" | "json";

function getPortfolioStatus(
  portfolio: Portfolio | null,
  generating: boolean
): PortfolioViewStatus {
  if (generating) {
    return "generating";
  }

  if (!portfolio) {
    return "unavailable";
  }

  switch (portfolio.generation_status) {
    case "pending":
    case "generating":
      return "generating";

    case "complete":
      return "complete";

    case "failed":
      return "failed";

    default:
      return "unavailable";
  }
}

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

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{
    id: string;
    sessionId: string;
  }>();

  const navigate = useNavigate();

  const assessmentId = Number(id);
  const numericSessionId = Number(sessionId);

  const [portfolio, setPortfolio] =
    useState<Portfolio | null>(null);

  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pollError, setPollError] = useState(false);

  const [overrides, setOverrides] = useState<
    Record<number, AssessorOverride>
  >({});

  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [vacanciesError, setVacanciesError] = useState(false);
  const [selectedVacancy, setSelectedVacancy] = useState("");

  const [exporting, setExporting] =
    useState<ExportFormat | null>(null);

  const [exportError, setExportError] = useState(false);
  const [candidateName, setCandidateName] =
    useState<string | null>(null);

  const [interviewSession, setInterviewSession] = useState<Session | null>(null);
  const [decision, setDecision] = useState<HiringDecision>("under_review");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [savingDecision, setSavingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionSuccess, setDecisionSuccess] = useState(false);

  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState(false);

  const candidatesUrl = `/assessments/${id}/invite`;

  const transcriptUrl =
    `/assessments/${id}/sessions/${sessionId}/transcript`;

  const fetchPortfolio = useCallback(async () => {
    if (
      !Number.isInteger(numericSessionId) ||
      numericSessionId <= 0
    ) {
      throw new Error("Invalid session ID.");
    }

    const response = await sessionsApi.getPortfolio(
      numericSessionId
    );

    const data = response.data;

    if ("portfolio" in data && data.portfolio) {
      const result = data.portfolio;

      setPortfolio(result);

      const overrideMap: Record<
        number,
        AssessorOverride
      > = {};

      (result.overrides ?? []).forEach((override) => {
        overrideMap[override.portfolio_skill_id] = override;
      });

      setOverrides(overrideMap);

      setGenerating(
        result.generation_status === "pending" ||
          result.generation_status === "generating"
      );
    } else if ("status" in data) {
      if (
        data.status === "pending" ||
        data.status === "generating"
      ) {
        setGenerating(true);
      } else {
        setGenerating(false);
      }
    }

    setPollError(false);
  }, [numericSessionId]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setVacanciesError(false);

    if (
      !Number.isInteger(assessmentId) ||
      assessmentId <= 0 ||
      !Number.isInteger(numericSessionId) ||
      numericSessionId <= 0
    ) {
      setLoadError(true);
      setLoading(false);
      return;
    }

    const [
      portfolioResult,
      vacancyResult,
      sessionResult,
    ] = await Promise.allSettled([
      fetchPortfolio(),
      vacanciesApi.list(1, "", 100),
      sessionsApi.get(numericSessionId),
    ]);

    if (portfolioResult.status === "rejected") {
      console.error(
        "Failed to load portfolio:",
        portfolioResult.reason
      );

      setLoadError(true);
    }

    if (vacancyResult.status === "fulfilled") {
      setVacancies(
        vacancyResult.value.data.vacancies
      );
    } else {
      console.error(
        "Failed to load vacancies:",
        vacancyResult.reason
      );

      setVacanciesError(true);
    }

    if (sessionResult.status === "fulfilled") {
      const loadedSession = sessionResult.value.data.session;
      setCandidateName(loadedSession.candidate_name ?? null);
      setInterviewSession(loadedSession);
      setDecision(loadedSession.hiring_decision ?? "under_review");
      setDecisionNotes(loadedSession.decision_notes ?? "");
      setDecisionError(null);
      setDecisionSuccess(false);
    } else {
      console.error(
        "Failed to load session:",
        sessionResult.reason
      );
    }

    setLoading(false);
  }, [
    assessmentId,
    numericSessionId,
    fetchPortfolio,
  ]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const pollPortfolio = useCallback(async () => {
    try {
      await fetchPortfolio();
    } catch (error) {
      console.error(
        "Failed to refresh portfolio:",
        error
      );

      setPollError(true);
    }
  }, [fetchPortfolio]);

  usePolling(
    pollPortfolio,
    5000,
    generating && !loading && !loadError
  );

  const handleOverrideSaved = (
    skillId: number,
    override: AssessorOverride
  ) => {
    setOverrides((previous) => ({
      ...previous,
      [skillId]: override,
    }));
  };

  const handleRunFitGap = () => {
    if (!portfolio || !selectedVacancy) {
      return;
    }

    navigate(
      `/assessments/${id}/sessions/${sessionId}/fitgap/${selectedVacancy}`
    );
  };

  const handleExport = async (format: ExportFormat) => {
    if (!portfolio || exporting) {
      return;
    }

    setExporting(format);
    setExportError(false);

    try {
      const response = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        selectedVacancy
          ? Number(selectedVacancy)
          : undefined
      );

      if (format === "json") {
        const blob = new Blob(
          [JSON.stringify(response.data, null, 2)],
          {
            type: "application/json",
          }
        );

        downloadBlob(
          blob,
          `portfolio-${sessionId}.json`
        );
      } else {
        const blob =
          response.data instanceof Blob
            ? response.data
            : new Blob(
                [response.data as BlobPart],
                {
                  type: "application/pdf",
                }
              );

        downloadBlob(
          blob,
          `portfolio-${sessionId}.pdf`
        );
      }
    } catch (error) {
      console.error(
        `Failed to export ${format}:`,
        error
      );

      setExportError(true);
    } finally {
      setExporting(null);
    }
  };

  const handleRegenerate = async () => {
    if (regenerating) {
      return;
    }

    setRegenerating(true);
    setRegenerateError(false);

    try {
      await sessionsApi.regeneratePortfolio(
        numericSessionId
      );

      setGenerating(true);
      await fetchPortfolio();
    } catch (error) {
      console.error(
        "Failed to regenerate portfolio:",
        error
      );

      setRegenerateError(true);
    } finally {
      setRegenerating(false);
    }
  };

  const handleSaveDecision = async () => {
    if (savingDecision || !interviewSession) return;

    setSavingDecision(true);
    setDecisionError(null);
    setDecisionSuccess(false);

    try {
      const response = await sessionsApi.updateDecision(
        numericSessionId,
        decision,
        decisionNotes.trim()
      );

      const updatedSession = response.data.session;
      setInterviewSession(updatedSession);
      setDecision(updatedSession.hiring_decision ?? "under_review");
      setDecisionNotes(updatedSession.decision_notes ?? "");
      setDecisionSuccess(true);
    } catch (error) {
      const apiError = error as {
        response?: { data?: { error?: string; message?: string } };
      };
      setDecisionError(
        apiError.response?.data?.error ??
          apiError.response?.data?.message ??
          "Unable to save the hiring decision. Please try again."
      );
    } finally {
      setSavingDecision(false);
    }
  };

  const status: PortfolioViewStatus = loading
    ? "loading"
    : getPortfolioStatus(portfolio, generating);

  const configuredSkills =
    portfolio?.skills.filter(
      (skill) => !skill.is_discovered
    ) ?? [];

  const discoveredSkills =
    portfolio?.skills.filter(
      (skill) => skill.is_discovered
    ) ?? [];

  const overrideCount = Object.keys(overrides).length;

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-7">
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-5 w-56" />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>

        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <AlertCircle className="h-7 w-7" />
        </div>

        <h1 className="mt-5 text-xl font-bold text-slate-900">
          Unable to Load Portfolio
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          The portfolio information could not be loaded.
          Please check your connection and try again.
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" asChild>
            <Link to={candidatesUrl}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>

          <Button
            onClick={() => {
              void loadPage();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-10">
      <header className="space-y-5">
        <Link
          to={candidatesUrl}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Candidates
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">
              Interview Assessment
            </p>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Portfolio Results
            </h1>

            <p className="text-sm leading-6 text-slate-500">
              Review AI-generated competency findings
              and add assessor judgments.
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

            {status === "complete" && (
              <>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    void handleExport("pdf");
                  }}
                  disabled={exporting !== null}
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
                  onClick={() => {
                    void handleExport("json");
                  }}
                  disabled={exporting !== null}
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
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">
              Candidate
            </p>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserRound className="h-5 w-5" />
            </div>
          </div>

          <p className="mt-4 truncate text-xl font-bold text-slate-900">
            {candidateName || "Candidate"}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Interview participant
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">
              Portfolio Status
            </p>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <ClipboardList className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            {status === "complete" && (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            )}

            {status === "generating" && (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}

            {status === "failed" && (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}

            <p className="text-xl font-bold capitalize text-slate-900">
              {status === "unavailable"
                ? "Not Available"
                : status}
            </p>
          </div>

          <p className="mt-2 text-xs text-slate-500">
            AI analysis progress
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">
              Assessed Skills
            </p>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Code2 className="h-5 w-5" />
            </div>
          </div>

          <p className="mt-4 text-2xl font-bold text-slate-900">
            {status === "complete"
              ? portfolio?.skills.length ?? 0
              : "—"}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Configured and discovered
          </p>
        </div>
      </section>

    

      {exportError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />

          <div>
            <p className="text-sm font-semibold text-red-800">
              Export Failed
            </p>

            <p className="mt-1 text-xs text-red-700">
              Unable to download the portfolio.
              Please try again.
            </p>
          </div>
        </div>
      )}

      {status === "generating" && (
        <section className="rounded-2xl border border-primary/20 bg-white p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>

          <h2 className="mt-6 text-xl font-bold text-slate-900">
            Generating Your Portfolio
          </h2>

          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
            The AI is reviewing the interview transcript
            and preparing competency findings. This page
            will update automatically when the results
            are ready.
          </p>

          <div className="mx-auto mt-6 flex max-w-sm items-center justify-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <RefreshCw className="h-4 w-4 text-primary" />
            Checking for updates every 5 seconds
          </div>

          {pollError && (
            <div className="mx-auto mt-5 max-w-md rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs leading-5 text-amber-800">
                The latest update could not be retrieved.
                We will keep checking automatically.
              </p>

              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => {
                  void pollPortfolio();
                }}
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Check Now
              </Button>
            </div>
          )}
        </section>
      )}

      {status === "failed" && (
        <section className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle className="h-7 w-7" />
          </div>

          <h2 className="mt-5 text-xl font-bold text-slate-900">
            Portfolio Generation Failed
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            We could not finish analyzing this interview.
            You can retry the portfolio generation.
          </p>

          {portfolio?.generation_error && (
            <p className="mx-auto mt-4 max-w-md rounded-xl bg-red-50 p-3 text-xs text-red-700">
              {portfolio.generation_error}
            </p>
          )}

          {regenerateError && (
            <p
              role="alert"
              className="mt-4 text-sm text-red-600"
            >
              Unable to restart generation.
              Please try again.
            </p>
          )}

          <Button
            className="mt-6 rounded-xl"
            onClick={() => {
              void handleRegenerate();
            }}
            disabled={regenerating}
          >
            {regenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}

            {regenerating
              ? "Restarting..."
              : "Retry Generation"}
          </Button>
        </section>
      )}

      {status === "unavailable" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ClipboardList className="mx-auto h-10 w-10 text-slate-300" />

          <h2 className="mt-4 text-lg font-bold text-slate-900">
            Portfolio Not Available
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            There is no portfolio available for this
            interview yet.
          </p>

          <Button
            variant="outline"
            className="mt-5 rounded-xl"
            onClick={() => {
              void loadPage();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </section>
      )}

      {status === "complete" && portfolio && (
        <>
          <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <Code2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />

            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Analysis Complete
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-600">
                Review each competency finding and its
                supporting evidence. You can adjust the
                assessed level using assessor overrides
                when needed.
              </p>
            </div>
          </div>

          <section className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-primary">
                  Competency Review
                </p>

                <h2 className="text-xl font-bold text-slate-900">
                  Configured Skills
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Skills defined in the original assessment.
                </p>
              </div>

              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                {configuredSkills.length} skills
              </span>
            </div>

            {configuredSkills.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
                <p className="text-sm text-slate-500">
                  No configured skills were included
                  in this portfolio.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {configuredSkills.map((skill) => (
                  <SkillPortfolioCard
                    key={skill.id}
                    skill={skill}
                    override={overrides[skill.id]}
                    onOverrideSaved={(override) => {
                      handleOverrideSaved(
                        skill.id,
                        override
                      );
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {discoveredSkills.length > 0 && (
            <section className="space-y-5 border-t border-slate-200 pt-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />

                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-700">
                      Additional Findings
                    </p>
                  </div>

                  <h2 className="text-xl font-bold text-slate-900">
                    Discovered Skills
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Competencies identified during the
                    interview that were not part of the
                    original assessment.
                  </p>
                </div>

                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  {discoveredSkills.length} discovered
                </span>
              </div>

              <div className="space-y-4">
                {discoveredSkills.map((skill) => (
                  <SkillPortfolioCard
                    key={skill.id}
                    skill={skill}
                    override={overrides[skill.id]}
                    onOverrideSaved={(override) => {
                      handleOverrideSaved(
                        skill.id,
                        override
                      );
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          {overrideCount > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />

              <p className="text-sm leading-6 text-sky-800">
                {overrideCount}{" "}
                {overrideCount === 1
                  ? "skill has"
                  : "skills have"}{" "}
                an assessor override. These adjustments
                are retained when viewing the portfolio.
              </p>
            </div>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ClipboardList className="h-5 w-5" />
                </div>

                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-primary">
                    Next Step
                  </p>

                  <h2 className="text-xl font-bold text-slate-900">
                    Fit/Gap Analysis
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Compare the candidate's assessed
                    competencies against the requirements
                    of a specific vacancy.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-800">
                  Select Vacancy
                </label>

                <Select
                  value={selectedVacancy}
                  onValueChange={setSelectedVacancy}
                  disabled={
                    vacanciesError ||
                    vacancies.length === 0
                  }
                >
                  <SelectTrigger className="h-11 w-full rounded-xl">
                    <SelectValue placeholder="Choose a vacancy..." />
                  </SelectTrigger>

                  <SelectContent>
                    {vacancies.map((vacancy) => (
                      <SelectItem
                        key={vacancy.id}
                        value={String(vacancy.id)}
                      >
                        {vacancy.role_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {vacanciesError ? (
                  <p className="text-xs text-red-600">
                    Vacancies could not be loaded.
                    Refresh the page to try again.
                  </p>
                ) : vacancies.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No vacancies are available yet.
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Choose the vacancy you want to
                    compare this candidate against.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <p className="text-xs text-slate-500">
                  Analysis uses the selected vacancy's
                  competency expectations.
                </p>

                <Button
                  className="h-11 rounded-xl px-5"
                  disabled={!selectedVacancy}
                  onClick={handleRunFitGap}
                >
                  Run Fit/Gap Analysis

                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>

            {interviewSession?.status === "ended" &&
        interviewSession.end_reason !== "error" && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
                    Internal HR Evaluation
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    Hiring Decision
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Record HR's decision after reviewing the interview. This decision
                    and its notes are not shared with the candidate.
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  interviewSession.hiring_decision === "accepted"
                    ? "bg-emerald-50 text-emerald-700"
                    : interviewSession.hiring_decision === "rejected"
                      ? "bg-red-50 text-red-700"
                      : "bg-amber-50 text-amber-700"
                }`}
              >
                {interviewSession.hiring_decision === "accepted"
                  ? "Accepted"
                  : interviewSession.hiring_decision === "rejected"
                    ? "Rejected"
                    : "Under Review"}
              </span>
            </div>
            <div className="space-y-5 p-5 sm:p-6">
              <fieldset disabled={savingDecision} className="space-y-3">
                <legend className="text-sm font-semibold text-slate-800">
                  Decision
                </legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {([
                    { value: "under_review", label: "Under Review", detail: "Not finalized" },
                    { value: "accepted", label: "Accepted", detail: "Proceed with hiring" },
                    { value: "rejected", label: "Rejected", detail: "Do not proceed" },
                  ] as const).map((item) => (
                    <label
                      key={item.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                        decision === item.value
                          ? "border-primary bg-primary/5"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="hiring_decision"
                        value={item.value}
                        checked={decision === item.value}
                        onChange={() => {
                          setDecision(item.value);
                          setDecisionSuccess(false);
                        }}
                        className="mt-1 accent-primary"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">
                          {item.label}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {item.detail}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-2">
                <Label htmlFor="hiring-decision-notes">HR Notes</Label>
                <Textarea
                  id="hiring-decision-notes"
                  value={decisionNotes}
                  onChange={(event) => {
                    setDecisionNotes(event.target.value);
                    setDecisionSuccess(false);
                  }}
                  maxLength={2000}
                  rows={4}
                  disabled={savingDecision}
                  placeholder="Optional internal notes about your decision..."
                  className="rounded-xl"
                />
                <p className="text-right text-xs text-slate-400">
                  {decisionNotes.length}/2000 characters
                </p>
              </div>
              {decisionError && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {decisionError}
                </p>
              )}
              {decisionSuccess && (
                <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  Hiring decision saved successfully.
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <p className="text-xs leading-5 text-slate-500">
                 .
                </p>
                <Button
                  type="button"
                  onClick={() => void handleSaveDecision()}
                  disabled={savingDecision}
                  className="rounded-xl"
                >
                  {savingDecision ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {savingDecision ? "Saving..." : "Save Decision"}
                </Button>
              </div>
            </div>
          </section>
        )}
        </>
      )}
    </div>
  );
}