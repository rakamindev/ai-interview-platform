import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { apiErrorMessage } from "@/services/api";
import { usePolling } from "@/hooks/usePolling";
import { useElapsedSeconds } from "@/hooks/useElapsedSeconds";
import { downloadBlob } from "@/utils/download";
import { ArrowLeft, Download, Loader2, RefreshCw, FileText } from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";

type LoadState = "loading" | "generating" | "ready" | "failed" | "error";

// Portfolio generation normally takes about two minutes; past this we tell the
// assessor something is probably wrong instead of spinning forever.
const SLOW_AFTER_SECONDS = 6 * 60;

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<LoadState>("loading");
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[] | null>(null);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [exportError, setExportError] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);

  const elapsed = useElapsedSeconds(status === "generating" ? generationStartedAt : null);

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await sessionsApi.getPortfolio(Number(sessionId));
      const data = res.data as {
        status?: string;
        generation_started_at?: string | null;
        portfolio?: Portfolio;
      };

      if (data.status === "pending" || data.status === "generating") {
        setGenerationStartedAt((prev) =>
          data.generation_started_at ? Date.parse(data.generation_started_at) : prev ?? Date.now()
        );
        setStatus("generating");
        return;
      }

      if (data.portfolio) {
        setPortfolio(data.portfolio);
        const overrideMap: Record<number, AssessorOverride> = {};
        data.portfolio.overrides.forEach((o) => {
          overrideMap[o.portfolio_skill_id] = o;
        });
        setOverrides(overrideMap);
        setStatus(data.portfolio.generation_status === "failed" ? "failed" : "ready");
      }
    } catch {
      setStatus((prev) => (prev === "generating" ? prev : "error"));
    }
  }, [sessionId]);

  useEffect(() => {
    fetchPortfolio();
    sessionsApi
      .get(Number(sessionId))
      .then((res) => setCandidateName(res.data.session.candidate_name ?? null))
      .catch(() => setCandidateName(null));
    vacanciesApi
      .list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setVacancies([]));
  }, [fetchPortfolio, sessionId]);

  usePolling(fetchPortfolio, 5000, status === "generating");

  const handleRetry = async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      await sessionsApi.regeneratePortfolio(Number(sessionId));
      setGenerationStartedAt(Date.now());
      setStatus("generating");
    } catch (e) {
      setRetryError(apiErrorMessage(e, "Retry failed. Check your connection and try again."));
    } finally {
      setRetrying(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setExportError(false);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        selectedVacancy ? Number(selectedVacancy) : undefined
      );
      const blob =
        format === "json"
          ? new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" })
          : new Blob([res.data as BlobPart], { type: "application/pdf" });
      downloadBlob(blob, `portfolio-${sessionId}.${format}`);
    } catch {
      setExportError(true);
    } finally {
      setExporting(null);
    }
  };

  const transcriptPath = `/assessments/${id}/sessions/${sessionId}/transcript`;
  const skills = portfolio?.skills ?? [];
  const configured = skills.filter((s) => !s.is_discovered);
  const discovered = skills.filter((s) => s.is_discovered);
  const ratedCount = configured.filter((s) => s.rating_status === "rated").length;
  const unratedCount = configured.length - ratedCount;
  const overrideCount = Object.keys(overrides).length;

  const renderCards = (list: typeof skills) =>
    list.map((skill) => (
      <SkillPortfolioCard
        key={skill.id}
        skill={skill}
        override={overrides[skill.id]}
        transcriptPath={transcriptPath}
        onOverrideSaved={(o) => setOverrides((prev) => ({ ...prev, [skill.id]: o }))}
      />
    ));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Link
            to={`/assessments/${id}/invite`}
            aria-label="Back to assessment"
            className="mt-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">Interview results</h1>
            {candidateName && <p className="break-words text-sm text-muted-foreground">{candidateName}</p>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={transcriptPath}>
              <FileText className="mr-1 h-3.5 w-3.5" /> Transcript
            </Link>
          </Button>
          {status === "ready" && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting}>
                {exporting === "pdf" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!!exporting}>
                {exporting === "json" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                JSON
              </Button>
            </>
          )}
        </div>
      </header>

      {exportError && (
        <p role="alert" className="text-sm text-red-700">
          The export failed. Try again, or download JSON instead.
        </p>
      )}

      {status === "loading" && (
        <div className="space-y-4" aria-busy="true" aria-label="Loading results">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {status === "error" && (
        <div role="alert" className="space-y-3 rounded-lg border border-red-200 p-6">
          <p className="font-medium text-red-800">The results could not be loaded.</p>
          <p className="text-sm text-muted-foreground">This is usually a connection problem. Nothing was lost.</p>
          <Button size="sm" variant="outline" onClick={() => { setStatus("loading"); fetchPortfolio(); }}>
            Try again
          </Button>
        </div>
      )}

      {status === "generating" && (
        <div role="status" className="space-y-2 rounded-lg border p-8 text-center">
          <Loader2 aria-hidden className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="font-medium">Reading the interview and rating each skill</p>
          <p className="text-sm text-muted-foreground">
            {elapsed < SLOW_AFTER_SECONDS
              ? `This usually takes about 2 minutes. ${Math.floor(elapsed / 60)}m ${elapsed % 60}s so far.`
              : "This is taking much longer than usual. The page keeps checking; if nothing changes, contact support with the session number."}
          </p>
        </div>
      )}

      {status === "failed" && (
        <div role="alert" className="space-y-3 rounded-lg border border-red-200 p-6">
          <p className="font-medium text-red-800">The results could not be generated.</p>
          <p className="text-sm text-muted-foreground">
            {portfolio?.generation_error
              ? `Reason: ${portfolio.generation_error}.`
              : "The AI service did not return a usable answer."}{" "}
            The interview transcript is saved, so retrying is safe.
          </p>
          {retryError && <p className="text-sm text-red-700">{retryError}</p>}
          <Button size="sm" variant="outline" onClick={handleRetry} disabled={retrying}>
            {retrying ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            Retry
          </Button>
        </div>
      )}

      {status === "ready" && portfolio && (
        <>
          <p className="text-sm text-muted-foreground">
            {ratedCount} of {configured.length} skills rated
            {unratedCount > 0 && <> · {unratedCount} not rated (not counted against the candidate)</>}
            {overrideCount > 0 && <> · {overrideCount} changed by an assessor</>}
          </p>

          <section aria-labelledby="configured-heading" className="space-y-3">
            <h2 id="configured-heading" className="text-sm font-semibold">Skills in this assessment</h2>
            {configured.length > 0 ? (
              renderCards(configured)
            ) : (
              <p className="text-sm text-muted-foreground">This assessment has no configured skills.</p>
            )}
          </section>

          {discovered.length > 0 && (
            <section aria-labelledby="discovered-heading" className="space-y-3">
              <div>
                <h2 id="discovered-heading" className="text-sm font-semibold">Other skills that came up</h2>
                <p className="text-sm text-muted-foreground">
                  The candidate showed these without being asked. They were only probed briefly.
                </p>
              </div>
              {renderCards(discovered)}
            </section>
          )}

          <section aria-labelledby="fitgap-heading" className="space-y-3 rounded-lg border p-4">
            <div>
              <h2 id="fitgap-heading" className="text-sm font-semibold">Compare with a vacancy</h2>
              <p className="text-sm text-muted-foreground">See where the candidate matches, exceeds or falls short of a role.</p>
            </div>
            {vacancies === null ? (
              <Skeleton className="h-9 w-64" />
            ) : vacancies.length === 0 ? (
              <p className="text-sm">
                No vacancies yet. <Link to="/vacancies/new" className="text-primary underline">Create a vacancy</Link> to compare against.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                  <SelectTrigger className="w-full sm:w-64" aria-label="Vacancy">
                    <SelectValue placeholder="Choose a vacancy" />
                  </SelectTrigger>
                  <SelectContent>
                    {vacancies.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.role_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/fitgap/${selectedVacancy}`)}
                  disabled={!selectedVacancy}
                >
                  Run fit/gap analysis
                </Button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
