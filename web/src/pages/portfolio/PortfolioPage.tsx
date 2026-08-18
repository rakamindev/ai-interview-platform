import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Callout } from "@/components/ui/callout";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { AlertTriangle, ArrowLeft, Download, Loader2, RefreshCw, Zap, FileText } from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  // Whether there is anything to show — a different question from whether the
  // last run succeeded.
  const hasSkills = (portfolio?.skills?.length ?? 0) > 0;
  const failed = portfolio?.generation_status === "failed";
  // Nothing is happening, nothing failed, and there is nothing to read.
  const isEmpty = !loading && !generating && !failed && !hasSkills;

  const fetchPortfolio = useCallback(async () => {
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    const data = res.data as any;
    if (data.status === "generating" || data.portfolio?.generation_status === "generating" || data.portfolio?.generation_status === "pending") {
      setGenerating(true);
    } else if (data.portfolio) {
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

  const load = useCallback(() => {
    setLoadError(null);
    setLoading(true);
    return Promise.all([
      fetchPortfolio(),
      vacanciesApi.list(),
      sessionsApi.get(Number(sessionId)),
    ])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data.vacancies);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      // Swallowed, this left a blank page — a network failure and a session with
      // no results looked identical.
      .catch((e: any) => {
        setLoadError(
          e?.response?.data?.errors?.[0]?.message ??
            e?.message ??
            "Could not reach the server.",
        );
      })
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while generating, but not forever — see usePolling.
  const stalled = usePolling(fetchPortfolio, 5000, generating);

  const handleOverrideSaved = (skillId: number, override: AssessorOverride) => {
    setOverrides((prev) => ({ ...prev, [skillId]: override }));
  };

  // Awaited with no catch, a rejected retry left the screen untouched: the
  // assessor clicked, nothing moved, so they clicked again. A rejection usually
  // means Sidekiq already restarted the job and the API is refusing a second
  // one, so re-read the status instead of asserting anything about it.
  const handleRetry = async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      await sessionsApi.regeneratePortfolio(Number(sessionId));
      setGenerating(true);
    } catch {
      await fetchPortfolio().catch(() => {});
      setRetryError(
        "Could not start a new run just now. The status above has been refreshed — try again in a moment.",
      );
    } finally {
      setRetrying(false);
    }
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
    } finally {
      setExporting(null);
    }
  };

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
      <div className="max-w-2xl mx-auto space-y-4">
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Could not load this portfolio"
          description={loadError}
          action={
            <Button variant="outline" size="sm" onClick={() => load()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try again
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Stacks on narrow screens so the export controls stay reachable. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Link to={`/assessments/${id}/invite`} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Portfolio Results</h1>
            {candidateName && (
              <p className="text-sm text-muted-foreground">{candidateName}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex items-center gap-1 text-sm border rounded-md px-3 py-1.5 hover:bg-accent transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Transcript
          </Link>
          {!generating && portfolio && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
              >
                {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
                disabled={!!exporting}
              >
                {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Generating state */}
      {generating && !stalled && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <div>
            <p className="font-medium">Generating portfolio...</p>
            <p className="text-sm text-muted-foreground mt-1">
              The AI is analyzing the interview transcript. This takes about 2 minutes.
            </p>
          </div>
        </div>
      )}

      {/* Past the ceiling. No claim of failure — the job may still be queued —
          just an end to the spinner promising two minutes indefinitely. */}
      {generating && stalled && (
        <Callout variant="warning" title="This is taking longer than expected">
          <div className="space-y-2">
            <p>
              The analysis has not finished after five minutes. It may still be
              queued and complete on its own, or the background worker may not be
              running. The interview recording and transcript are safe either way.
            </p>
            <Button variant="outline" size="sm" onClick={() => load()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Check again
            </Button>
          </div>
        </Callout>
      )}

      {/* A failed run does not mean there is nothing to show: an earlier run may
          have written a full set of skills that a later duplicate marked failed.
          Say what broke, offer the retry, and still render what exists below. */}
      {!generating && failed && (
        <Callout variant="error" title="Portfolio generation failed">
          <div className="space-y-2">
            <p>
              The AI could not finish analysing this interview. The recording and
              transcript are unaffected — retrying runs the analysis again on the
              same material.
            </p>
            {hasSkills && (
              <p>
                Results from an earlier successful run are shown below. Retrying replaces them.
              </p>
            )}
            {retryError && <p className="font-medium">{retryError}</p>}
            <Button variant="outline" size="sm" onClick={handleRetry} disabled={retrying}>
              {retrying ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Retry
            </Button>
          </div>
        </Callout>
      )}

      {/* Empty */}
      {isEmpty && (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No results for this session"
          description="The interview produced no rated skills. This usually means the session ended before the AI reached any of the configured agenda."
          action={
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/transcript`}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              <FileText className="h-3.5 w-3.5" /> Read the transcript
            </Link>
          }
        />
      )}

      {/* Ready state */}
      {!generating && portfolio && hasSkills && (
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
                    <Zap className="h-4 w-4 text-amber-500" />
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
                      onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                    />
                  ))}
              </div>
            </>
          )}

          <Separator />

          {/* Fit/Gap */}
          <div className="flex items-center gap-3">
            <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
              <SelectTrigger className="w-56">
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
              Run Fit/Gap Analysis →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
