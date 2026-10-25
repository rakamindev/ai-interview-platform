import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { extractApiError } from "@/lib/apiErrors";
import { parseLevel } from "@/utils/constants";
import { toast } from "@/stores/toastStore";
import { sessionKeys, vacancyKeys } from "@/lib/queryKeys";
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Zap,
  FileText,
  AlertTriangle,
  Pencil,
  Gauge,
  ListChecks,
  ShieldCheck,
} from "lucide-react";
import type { Portfolio, AssessorOverride } from "@/types";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const numericSessionId = Number(sessionId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);

  const portfolioQuery = useQuery({
    queryKey: sessionKeys.portfolio(numericSessionId),
    queryFn: async () => (await sessionsApi.getPortfolio(numericSessionId)).data,
    refetchInterval: (query) => {
      const data = query.state.data;
      const generating =
        data &&
        (("status" in data && data.status === "generating") ||
          ("portfolio" in data && ["generating", "pending"].includes(data.portfolio.generation_status)));
      return generating ? 5_000 : false;
    },
  });
  const vacanciesQuery = useQuery({
    queryKey: vacancyKeys.list(1, 100),
    queryFn: async () => (await vacanciesApi.list({ page: 1, perPage: 100 })).data,
  });
  const sessionQuery = useQuery({
    queryKey: sessionKeys.detail(numericSessionId),
    queryFn: async () => (await sessionsApi.get(numericSessionId)).data,
  });

  const regenerateMutation = useMutation({
    mutationFn: () => sessionsApi.regeneratePortfolio(numericSessionId),
    onSuccess: () => {
      queryClient.setQueryData(sessionKeys.portfolio(numericSessionId), {
        status: "generating",
      });
    },
  });

  const portfolioResponse = portfolioQuery.data;
  const portfolio: Portfolio | null =
    portfolioResponse && "portfolio" in portfolioResponse ? portfolioResponse.portfolio : null;
  const generating = Boolean(
    portfolioResponse &&
      (("status" in portfolioResponse && portfolioResponse.status === "generating") ||
        ("portfolio" in portfolioResponse &&
          ["generating", "pending"].includes(portfolioResponse.portfolio.generation_status)))
  );
  const vacancies = vacanciesQuery.data?.vacancies ?? [];
  const vacancyMeta = vacanciesQuery.data?.meta ?? null;
  const candidateName = sessionQuery.data?.session.candidate_name ?? null;
  const missingAssessmentSkills = portfolio?.failure_reason === "missing_assessment_skills";
  const missingCoverage = portfolio?.failure_reason === "missing_coverage";
  const configurationError = missingAssessmentSkills || missingCoverage;

  useEffect(() => {
    if (!portfolio) return;
    setOverrides(
      Object.fromEntries(
        portfolio.overrides.map((override) => [override.portfolio_skill_id, override])
      )
    );
  }, [portfolio]);

  const handleOverrideSaved = (skillId: number, override: AssessorOverride) => {
    setOverrides((prev) => ({ ...prev, [skillId]: override }));
  };

  const handleRunFitGap = () => {
    if (!selectedVacancy || !portfolio) return;
    navigate(`/assessments/${id}/sessions/${sessionId}/fitgap/${selectedVacancy}`);
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        selectedVacancy ? Number(selectedVacancy) : undefined
      );
      if (format === "json") {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-${sessionId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-${sessionId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      // F-26: export failures surface as a toast with a retry hint instead of
      // silently doing nothing.
      toast.error("Export failed", extractApiError(e).message, () => handleExport(format));
    } finally {
      setExporting(null);
    }
  };

  const configuredSkillCount = portfolio?.skills.filter((skill) => !skill.is_discovered).length ?? 0;
  const discoveredSkillCount = portfolio?.skills.filter((skill) => skill.is_discovered).length ?? 0;
  const skillCount = portfolio?.skills.length ?? 0;
  const averageLevel =
    skillCount === 0
      ? 0
      : (portfolio?.skills.reduce(
          (total, skill) =>
            total + (overrides[skill.id]?.override_level ?? parseLevel(skill.ai_level)),
          0
        ) ?? 0) / skillCount;
  const levelEstimatePercentage = Math.round((averageLevel / 5) * 100);
  const mediumHighConfidenceCount =
    portfolio?.skills.filter((skill) =>
      ["medium", "high"].includes(skill.ai_confidence?.toLowerCase())
    ).length ?? 0;
  const confidencePercentage =
    skillCount === 0 ? 0 : Math.round((mediumHighConfidenceCount / skillCount) * 100);
  const vacancyOptionsTruncated = (vacancyMeta?.total_count ?? vacancies.length) > vacancies.length;

  const loading = portfolioQuery.isPending || vacanciesQuery.isPending || sessionQuery.isPending;
  const loadError =
    (!portfolioQuery.data && portfolioQuery.error) || vacanciesQuery.error || sessionQuery.error;

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl">
        <div
          role="alert"
          className="space-y-3 rounded-lg border border-destructive/40 p-10 text-center animate-in fade-in duration-200"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-base font-semibold">Couldn't load this portfolio</h1>
            <p className="mt-1 break-words text-sm text-muted-foreground">{extractApiError(loadError).message}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={() =>
                void Promise.all([
                  portfolioQuery.refetch(),
                  vacanciesQuery.refetch(),
                  sessionQuery.refetch(),
                ])
              }
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Retry
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/assessments/${id}/invite`)}
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Back
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
            to={`/assessments/${id}/invite`}
            aria-label="Back to assessment"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div className="min-w-0 pt-1">
            <h1 className="text-lg font-semibold">Portfolio Results</h1>
            {candidateName && (
              <p className="break-words text-sm text-muted-foreground">{candidateName}</p>
            )}
            {generating && <p className="mt-1 text-xs text-muted-foreground">Generating</p>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            Transcript
          </Link>
          {!generating && portfolio?.generation_status === "complete" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
              >
                {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Download className="h-3.5 w-3.5 mr-1" aria-hidden="true" />}
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
                disabled={!!exporting}
              >
                {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Download className="h-3.5 w-3.5 mr-1" aria-hidden="true" />}
                JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Generating state */}
      {generating && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" aria-hidden="true" />
          <div>
            <p className="font-medium">Generating portfolio…</p>
            <p className="text-sm text-muted-foreground mt-1">
              The AI is analyzing the interview transcript. This takes about 2 minutes.
            </p>
          </div>
        </div>
      )}

      {!generating &&
        (portfolio?.generation_status === "complete" ||
          portfolio?.generation_status === "partial") && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Portfolio skill summary">
            <div
              aria-label={`Level estimate: ${levelEstimatePercentage}%`}
              className="rounded-lg border border-violet-200 bg-violet-50 p-3.5"
            >
              <div className="flex items-center gap-2 text-violet-700">
                <Gauge className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wide">Level estimate</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-violet-950">
                {levelEstimatePercentage}%
              </p>
              <p className="mt-1 text-xs text-violet-800/75">
                Average L{averageLevel.toFixed(1)} of L5
              </p>
            </div>
            <div
              aria-label={`Confidence estimate: ${confidencePercentage}%`}
              className="rounded-lg border border-teal-200 bg-teal-50 p-3.5"
            >
              <div className="flex items-center gap-2 text-teal-700">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wide">Confidence</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-teal-950">
                {confidencePercentage}%
              </p>
              <p className="mt-1 text-xs text-teal-800/75">
                {mediumHighConfidenceCount} of {skillCount} medium or high
              </p>
            </div>
            <div
              aria-label={`Skills assessed: ${skillCount}`}
              className="rounded-lg border border-sky-200 bg-sky-50 p-3.5"
            >
              <div className="flex items-center gap-2 text-sky-700">
                <ListChecks className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wide">Skills assessed</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-sky-950">{skillCount}</p>
              <p className="mt-1 text-xs text-sky-800/75">
                {configuredSkillCount} configured · {discoveredSkillCount} discovered
              </p>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-3">
              Directional estimate only. Skills are weighted equally; this is not a hiring score.
            </p>
          </div>
        )}

      {/* Failed state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <div
          role="alert"
          className="border border-destructive/40 rounded-lg p-10 text-center space-y-3 animate-in fade-in duration-200"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {configurationError ? "This portfolio can't be generated" : "Couldn't generate this portfolio"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {missingAssessmentSkills
                ? "This assessment has no skills to evaluate. Add at least one skill, then create a new interview."
                : missingCoverage
                  ? "This interview has no skill coverage to evaluate. Return to the assessment and create a new interview."
                  : "Something went wrong while analyzing the interview. Try again to restart portfolio generation."}
            </p>
          </div>
          {configurationError ? (
            <Button
              size="sm"
              onClick={() => navigate(`/assessments/${id}/${missingAssessmentSkills ? "edit" : "invite"}`)}
            >
              {missingAssessmentSkills ? (
                <Pencil className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              ) : (
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              )}
              {missingAssessmentSkills ? "Edit assessment" : "Back to assessment"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" /> Retry
            </Button>
          )}
        </div>
      )}

      {/* Partial state — some skills saved, some failed */}
      {!generating && portfolio?.generation_status === "partial" && (
        <div className="border border-amber-400/50 bg-amber-50 rounded-lg p-4 space-y-1">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="text-sm font-medium">Portfolio partially generated</p>
          </div>
          <p className="text-xs text-amber-800/80 pl-6">
            Some skills could not be generated.{" "}
            {portfolio.generation_error
              ? `Details: ${portfolio.generation_error}`
              : "The AI returned incomplete data for some skills. The skills below are still valid."}
          </p>
        </div>
      )}

      {/* Ready state */}
      {!generating &&
        (portfolio?.generation_status === "complete" || portfolio?.generation_status === "partial") && (
        <>
          {/* Configured skills */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Configured Skills</h2>
            {portfolio.skills
              .filter((s) => !s.is_discovered)
              .map((skill) => (
                <SkillPortfolioCard
                  key={skill.id}
                  skill={skill}
                  override={overrides[skill.id]}
                  transcriptPath={`/assessments/${id}/sessions/${sessionId}/transcript`}
                  onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                />
              ))}
          </div>

          {/* Discovered skills */}
          {portfolio.skills.some((s) => s.is_discovered) && (
            <>
              <Separator />
              <div className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" aria-hidden="true" />
                    Discovered Skills
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Skills the AI probed that were not in the original assessment
                  </p>
                </div>
                {portfolio.skills
                  .filter((s) => s.is_discovered)
                  .map((skill) => (
                    <SkillPortfolioCard
                      key={skill.id}
                      skill={skill}
                      override={overrides[skill.id]}
                      transcriptPath={`/assessments/${id}/sessions/${sessionId}/transcript`}
                      onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                    />
                  ))}
              </div>
            </>
          )}

          {portfolio?.generation_status === "complete" && (
            <>
              <Separator />

              {/* Fit/Gap */}
              <Card>
                <CardHeader className="space-y-1 p-4 pb-3">
                  <CardTitle className="text-base">Compare Against a Vacancy</CardTitle>
                  <CardDescription>
                    Compare this candidate portfolio with the skills and expectations configured for
                    a vacancy.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-0">
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                    <Select
                      value={selectedVacancy}
                      onValueChange={setSelectedVacancy}
                      disabled={vacancies.length === 0}
                    >
                      <SelectTrigger className="min-w-0 flex-1">
                        <SelectValue
                          placeholder={
                            vacancies.length === 0 ? "No vacancies available" : "Choose a vacancy"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {vacancies.map((vacancy) => (
                          <SelectItem key={vacancy.id} value={String(vacancy.id)}>
                            {vacancy.role_title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      className="shrink-0"
                      onClick={handleRunFitGap}
                      disabled={!selectedVacancy}
                    >
                      Run Fit/Gap Analysis →
                    </Button>
                  </div>
                  {vacancyOptionsTruncated && (
                    <p className="text-xs text-muted-foreground" role="note">
                      Showing the first {vacancies.length} of{" "}
                      {new Intl.NumberFormat().format(vacancyMeta?.total_count ?? vacancies.length)}{" "}
                      vacancies. Vacancy search is not available yet.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
