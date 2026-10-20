import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, FileText } from "lucide-react";
import { END_REASON_LABELS, parseLevel } from "@/utils/constants";
import { proctoringSummaryText } from "@/utils/proctoring";
import type { Portfolio, AssessorOverride, Vacancy, Session } from "@/types";

// Generation usually takes about two minutes; past three, stop polling and tell the assessor (P2-22).
export const PORTFOLIO_WAIT_TIMEOUT_MS = 3 * 60_000;

/**
 * "2 of 3 skills weren't assessed. The interview ended after 6 minutes (ended by the candidate)." (AC-24)
 * Counts configured skills with no level that nobody has rated yet. The end reason is only repeated when it
 * can't contradict the result: "all_covered" can be sent by anyone with the invite link (Step 3, P1-10).
 */
export function notAssessedSummary(portfolio: Portfolio, overrides: Record<number, AssessorOverride>, session: Session | null) {
  const configured = portfolio.skills.filter((s) => !s.is_discovered);
  const missing = configured.filter((s) => parseLevel(s.ai_level) === null && !overrides[s.id]);
  if (missing.length === 0) return null;

  const total = configured.length;
  let text = `${missing.length} of ${total} skill${total !== 1 ? "s" : ""} ${missing.length === 1 ? "wasn't" : "weren't"} assessed.`;

  const minutes = session?.duration_seconds != null ? Math.floor(session.duration_seconds / 60) : null;
  const ending = session?.end_reason ? END_REASON_LABELS[session.end_reason] : undefined;
  const allUnreached = missing.every((s) => s.not_assessed_reason === "not_reached");

  if (minutes !== null) {
    const after = `The interview ended after ${minutes} minute${minutes !== 1 ? "s" : ""}`;
    if (ending) text += ` ${after} (${ending}).`;
    else if (allUnreached) text += ` ${after}, before ${missing.length === 1 ? "it was" : "they were"} reached.`;
    else text += ` ${after}.`;
  }
  return text;
}

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
  const [session, setSession] = useState<Session | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const waitStartedAt = useRef<number | null>(null);

  const fetchPortfolio = useCallback(async () => {
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    const data = res.data as any;
    if (data.status === "generating" || data.portfolio?.generation_status === "generating" || data.portfolio?.generation_status === "pending") {
      // Stop after a while and say so, rather than spin while nothing runs the job (P2-22).
      if (waitStartedAt.current === null) waitStartedAt.current = Date.now();
      if (Date.now() - waitStartedAt.current > PORTFOLIO_WAIT_TIMEOUT_MS) {
        setGenerating(false);
        setTimedOut(true);
        return;
      }
      setGenerating(true);
    } else if (data.portfolio) {
      waitStartedAt.current = null;
      setTimedOut(false);
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

  // The portfolio is what the page is for: if it can't load, say so and offer a retry (AC-27, P2-1).
  // The session and the vacancy list only add context, so their failures don't block the page.
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      await fetchPortfolio();
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [fetchPortfolio]);

  useEffect(() => {
    load();
    vacanciesApi.list().then((res) => setVacancies(res.data.vacancies)).catch(() => setVacancies([]));
    sessionsApi.get(Number(sessionId)).then((res) => setSession(res.data.session)).catch(() => setSession(null));
  }, [load, sessionId]);

  // Poll while generating
  usePolling(fetchPortfolio, 5000, generating);

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
    } finally {
      setExporting(null);
    }
  };

  const handleRetryGeneration = async () => {
    setRetrying(true);
    try {
      await sessionsApi.regeneratePortfolio(Number(sessionId));
      setGenerating(true);
    } finally {
      setRetrying(false);
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

  const candidateName = session?.candidate_name ?? null;
  const summary = portfolio?.generation_status === "complete" ? notAssessedSummary(portfolio, overrides, session) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header: the actions wrap under the title on a phone (AC-29) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <Link to={`/assessments/${id}/invite`} className="text-muted-foreground hover:text-foreground" aria-label="Back to the candidates">
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

      {/* Load failure */}
      {loadError && (
        <div role="alert" className="border border-destructive/40 rounded-lg p-6 text-center space-y-3">
          <div>
            <p className="font-medium">Couldn't load the portfolio.</p>
            <p className="text-sm text-muted-foreground mt-1">Check your connection, then try again.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try again
          </Button>
        </div>
      )}

      {/* Generating state */}
      {generating && (
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

      {/* Still generating well past the usual time */}
      {timedOut && (
        <div role="alert" className="border border-amber-300 rounded-lg p-6 text-center space-y-3">
          <div>
            <p className="font-medium">This is taking longer than expected.</p>
            <p className="text-sm text-muted-foreground mt-1">
              The portfolio is still being generated after 3 minutes; it usually takes about 2. Check again in a few
              minutes, and if it still isn't ready, let your administrator know.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              waitStartedAt.current = null;
              setTimedOut(false);
              load();
            }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Check again
          </Button>
        </div>
      )}

      {/* Failed state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <div role="alert" className="border border-destructive/40 rounded-lg p-6 text-center space-y-3">
          <div>
            <p className="font-medium">Portfolio generation failed.</p>
            {/* The API's safe message for the failure category, never the raw error (AC-21). */}
            {portfolio.generation_error && (
              <p className="text-sm text-muted-foreground mt-1">{portfolio.generation_error}</p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handleRetryGeneration} disabled={retrying}>
            {retrying ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Retry
          </Button>
        </div>
      )}

      {/* Ready state */}
      {!generating && portfolio?.generation_status === "complete" && (
        <>
          {/* How much of the result is unknown, before any single skill (AC-24) */}
          {summary && (
            <div className="rounded-lg border border-dashed px-4 py-3">
              <p className="text-sm text-muted-foreground">{summary}</p>
            </div>
          )}

          {/* Proctored interviews: did the camera and screen share stay on */}
          {session?.proctoring && (
            <div className="rounded-lg border border-dashed px-4 py-3">
              <p className="text-sm text-muted-foreground">{proctoringSummaryText(session.proctoring)}</p>
            </div>
          )}

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
              <SelectTrigger className="w-full sm:w-56" aria-label="Vacancy to compare against">
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
