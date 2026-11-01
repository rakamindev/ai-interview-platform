import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import LoadError from "@/components/LoadError";
import FormSection from "@/components/FormSection";
import Notice from "@/components/Notice";
import PageHeader from "@/components/layout/PageHeader";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiError";
import { downloadBlob } from "@/utils/download";
import { ArrowRight, Download, Loader2, RefreshCw, Zap, FileText } from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";

// Generation normally takes ~2 minutes; stop polling well past that so a stuck job is visible.
const GENERATION_TIMEOUT_MS = 10 * 60 * 1000;

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [generationTimedOut, setGenerationTimedOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [vacanciesError, setVacanciesError] = useState(false);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    const data = res.data;
    if (
      ("status" in data && data.status === "generating") ||
      ("portfolio" in data &&
        (data.portfolio.generation_status === "generating" ||
          data.portfolio.generation_status === "pending"))
    ) {
      setGenerating(true);
      setGenerationStartedAt((startedAt) => startedAt ?? Date.now());
    } else if ("portfolio" in data) {
      setPortfolio(data.portfolio);
      setGenerating(false);
      // Build overrides map
      const overrideMap: Record<number, AssessorOverride> = {};
      data.portfolio.overrides.forEach((o: AssessorOverride) => {
        overrideMap[o.portfolio_skill_id] = o;
      });
      setOverrides(overrideMap);
    }
  }, [sessionId]);

  const loadPage = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    // Vacancies only feed the fit/gap picker; their failure must not hide the results.
    vacanciesApi
      .list()
      .then((vRes) => {
        setVacancies(vRes.data.vacancies);
        setVacanciesError(false);
      })
      .catch(() => setVacanciesError(true));
    Promise.all([fetchPortfolio(), sessionsApi.get(Number(sessionId))])
      .then(([, sRes]) => setCandidateName(sRes.data.session.candidate_name ?? null))
      .catch((requestError: unknown) =>
        setLoadError(
          getApiErrorStatus(requestError) === 404
            ? "This session doesn't exist or was deleted."
            : getApiErrorMessage(requestError, "Failed to load the portfolio."),
        ),
      )
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const pollPortfolio = useCallback(async () => {
    if (generationStartedAt && Date.now() - generationStartedAt > GENERATION_TIMEOUT_MS) {
      setGenerationTimedOut(true);
      return;
    }
    try {
      await fetchPortfolio();
    } catch {
      // Transient poll failure — try again on the next interval.
    }
  }, [fetchPortfolio, generationStartedAt]);

  usePolling(pollPortfolio, 5000, generating && !generationTimedOut);

  const checkAgain = () => {
    setGenerationTimedOut(false);
    setGenerationStartedAt(Date.now());
    pollPortfolio();
  };

  const handleRetryGeneration = async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      await sessionsApi.regeneratePortfolio(Number(sessionId));
      setGenerationTimedOut(false);
      setGenerationStartedAt(Date.now());
      setGenerating(true);
    } catch (requestError: unknown) {
      setRetryError(getApiErrorMessage(requestError, "Failed to restart generation."));
    } finally {
      setRetrying(false);
    }
  };

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
    setExportError(null);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        selectedVacancy ? Number(selectedVacancy) : undefined,
      );
      const blob =
        format === "json"
          ? new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" })
          : new Blob([res.data as BlobPart], { type: "application/pdf" });
      downloadBlob(blob, `portfolio-${sessionId}.${format}`);
    } catch (requestError: unknown) {
      setExportError(getApiErrorMessage(requestError, "Export failed. Please try again."));
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          backTo={`/assessments/${id}/invite`}
          backLabel="Back to assessment"
          title="Portfolio Results"
        />
        <LoadError message={loadError} onRetry={loadPage} />
      </div>
    );
  }

  const configuredSkills = portfolio?.skills.filter((s) => !s.is_discovered) ?? [];
  const discoveredSkills = portfolio?.skills.filter((s) => s.is_discovered) ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        backTo={`/assessments/${id}/invite`}
        backLabel="Back to assessment"
        eyebrow="Assessment result"
        title="Portfolio Results"
        description={candidateName}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/assessments/${id}/sessions/${sessionId}/transcript`}>
                <FileText /> Transcript
              </Link>
            </Button>
            {!generating && portfolio && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("pdf")}
                  disabled={!!exporting}
                >
                  {exporting === "pdf" ? <Loader2 className="animate-spin" /> : <Download />}
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("json")}
                  disabled={!!exporting}
                >
                  {exporting === "json" ? <Loader2 className="animate-spin" /> : <Download />}
                  JSON
                </Button>
              </>
            )}
          </>
        }
      />

      {exportError && <Notice variant="error">{exportError}</Notice>}

      {/* Generation is taking far longer than expected */}
      {generating && generationTimedOut && (
        <Notice
          variant="warning"
          action={
            <Button variant="outline" size="sm" onClick={checkAgain}>
              <RefreshCw /> Check again
            </Button>
          }
        >
          Portfolio generation is taking longer than expected. It may still finish, or the job may
          be stuck.
        </Notice>
      )}

      {/* Generating state */}
      {generating && !generationTimedOut && (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rakamin-light-cyan">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </span>
          <div>
            <p className="font-medium">Generating portfolio...</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The AI is analyzing the interview transcript. This takes about 2 minutes.
            </p>
          </div>
        </Card>
      )}

      {/* Failed state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <Notice
          variant="error"
          title="Portfolio generation failed."
          action={
            <Button variant="outline" size="sm" onClick={handleRetryGeneration} disabled={retrying}>
              {retrying ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Retry
            </Button>
          }
        >
          {retryError}
        </Notice>
      )}

      {/* Ready state */}
      {!generating && portfolio?.generation_status === "complete" && (
        <>
          <section className="space-y-3">
            <h2 className="font-semibold">Configured Skills</h2>
            {configuredSkills.map((skill) => (
              <SkillPortfolioCard
                key={skill.id}
                skill={skill}
                override={overrides[skill.id]}
                onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
              />
            ))}
          </section>

          {discoveredSkills.length > 0 && (
            <section className="space-y-3">
              <div className="space-y-1">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Zap className="h-4 w-4 text-rakamin-dark-teal" />
                  Discovered Skills
                </h2>
                <p className="text-sm text-muted-foreground">
                  Skills the AI probed that were not in the original assessment
                </p>
              </div>
              {discoveredSkills.map((skill) => (
                <SkillPortfolioCard
                  key={skill.id}
                  skill={skill}
                  override={overrides[skill.id]}
                  onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                />
              ))}
            </section>
          )}

          {/* Fit/Gap */}
          <FormSection
            title="Compare with a vacancy"
            description="Run a fit/gap analysis of this portfolio against a role's expected skill levels."
          >
            {vacanciesError ? (
              <Notice variant="error">
                Couldn't load vacancies for fit/gap analysis. Refresh the page to try again.
              </Notice>
            ) : vacancies.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                To run a fit/gap analysis,{" "}
                <Link to="/vacancies/new" className="font-medium text-primary hover:underline">
                  create a vacancy
                </Link>{" "}
                first.
              </p>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                  <SelectTrigger className="sm:w-64" aria-label="Vacancy">
                    <SelectValue placeholder="Choose vacancy..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vacancies.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.role_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleRunFitGap} disabled={!selectedVacancy}>
                  Run Fit/Gap Analysis <ArrowRight />
                </Button>
              </div>
            )}
          </FormSection>
        </>
      )}
    </div>
  );
}
