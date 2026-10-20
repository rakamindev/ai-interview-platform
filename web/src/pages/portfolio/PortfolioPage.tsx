import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { ArrowLeft, Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import StatePanel from "@/components/StatePanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { downloadFile } from "@/utils/download";
import { cn } from "@/lib/utils";
import type { AssessorOverride, Portfolio, PortfolioSkill, Vacancy } from "@/types";

export const POLL_INTERVAL_MS = 5_000;
/** After this long, generation is still polled but the page says it is taking longer than usual. */
export const SLOW_AFTER_MS = 3 * 60_000;

type View =
  | { kind: "loading" }
  | { kind: "load_error" }
  | { kind: "not_ready"; sessionStatus: string }
  | { kind: "generating"; lastError: string | null }
  | { kind: "failed"; reason: string | null }
  | { kind: "ready"; portfolio: Portfolio };

function applyOverride(skill: PortfolioSkill, override: AssessorOverride): PortfolioSkill {
  return { ...skill, override, effective_level: override.override_level };
}

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [slow, setSlow] = useState(false);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [vacancies, setVacancies] = useState<Vacancy[] | null>(null);
  const [selectedVacancy, setSelectedVacancy] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const generatingSince = useRef<number | null>(null);

  const fetchPortfolio = useCallback(async () => {
    try {
      const { data } = await sessionsApi.getPortfolio(Number(sessionId));
      if ("portfolio" in data) {
        generatingSince.current = null;
        setView(
          data.portfolio.generation_status === "failed"
            ? { kind: "failed", reason: data.portfolio.generation_error }
            : { kind: "ready", portfolio: data.portfolio },
        );
      } else if (data.status === "not_ready") {
        setView({ kind: "not_ready", sessionStatus: data.session_status });
      } else {
        generatingSince.current ??= Date.now();
        setSlow(Date.now() - generatingSince.current > SLOW_AFTER_MS);
        setView({ kind: "generating", lastError: data.last_error });
      }
    } catch {
      // Keep showing generation progress through a transient polling error; otherwise show the error.
      setView((current) => (current.kind === "generating" ? current : { kind: "load_error" }));
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

  usePolling(fetchPortfolio, POLL_INTERVAL_MS, view.kind === "generating");

  const handleRetry = async () => {
    setRetrying(true);
    setActionError(null);
    try {
      await sessionsApi.regeneratePortfolio(Number(sessionId));
      generatingSince.current = Date.now();
      setView({ kind: "generating", lastError: null });
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409) {
        setView({ kind: "generating", lastError: null }); // someone else already restarted it
      } else {
        setActionError("Couldn't restart generation. Check your connection and try again.");
      }
    } finally {
      setRetrying(false);
    }
  };

  const handleOverrideSaved = (skillId: number, override: AssessorOverride) => {
    setView((current) =>
      current.kind !== "ready"
        ? current
        : {
            kind: "ready",
            portfolio: {
              ...current.portfolio,
              skills: current.portfolio.skills.map((s) => (s.id === skillId ? applyOverride(s, override) : s)),
            },
          },
    );
  };

  const handleExport = async (portfolio: Portfolio, format: "pdf" | "json") => {
    setExporting(format);
    setActionError(null);
    try {
      const res = await portfoliosApi.exportPortfolio(portfolio.id, format);
      if (format === "pdf") downloadFile(res.data as BlobPart, `portfolio-${sessionId}.pdf`, "application/pdf");
      else downloadFile(JSON.stringify(res.data, null, 2), `portfolio-${sessionId}.json`, "application/json");
    } catch {
      setActionError(`Couldn't export the ${format.toUpperCase()}. Try again in a moment.`);
    } finally {
      setExporting(null);
    }
  };

  const configured = view.kind === "ready" ? view.portfolio.skills.filter((s) => !s.is_discovered) : [];
  const discovered = view.kind === "ready" ? view.portfolio.skills.filter((s) => s.is_discovered) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Link
            to={`/assessments/${id}/invite`}
            aria-label="Back to candidates"
            className="mt-1 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Skill portfolio</h1>
            {candidateName && <p className="text-sm text-muted-foreground">{candidateName}</p>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/assessments/${id}/sessions/${sessionId}/transcript`}>
              <FileText aria-hidden className="mr-1.5 h-3.5 w-3.5" /> Transcript
            </Link>
          </Button>
          {view.kind === "ready" &&
            (["pdf", "json"] as const).map((format) => (
              <Button
                key={format}
                variant="outline"
                size="sm"
                onClick={() => handleExport(view.portfolio, format)}
                disabled={!!exporting}
              >
                {exporting === format ? (
                  <Loader2 aria-hidden className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download aria-hidden className="mr-1.5 h-3.5 w-3.5" />
                )}
                Export {format.toUpperCase()}
              </Button>
            ))}
        </div>
      </header>

      {actionError && (
        <p role="alert" className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      )}

      <div aria-live="polite">
        {view.kind === "loading" && (
          <div className="space-y-4" aria-label="Loading portfolio">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {view.kind === "load_error" && (
          <StatePanel title="Couldn't load this portfolio" body="Check your connection, then try again.">
            <Button variant="outline" size="sm" onClick={() => { setView({ kind: "loading" }); fetchPortfolio(); }}>
              <RefreshCw aria-hidden className="mr-1.5 h-3.5 w-3.5" /> Try again
            </Button>
          </StatePanel>
        )}

        {view.kind === "not_ready" && (
          <StatePanel
            title={view.sessionStatus === "active" ? "The interview is still in progress" : "The interview hasn't started yet"}
            body="The portfolio is generated when the interview ends."
          >
            {view.sessionStatus === "active" && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/assessments/${id}/sessions/${sessionId}/monitor`}>Watch it live</Link>
              </Button>
            )}
          </StatePanel>
        )}

        {view.kind === "generating" && (
          <StatePanel
            title="Generating the portfolio"
            body={
              slow
                ? "This is taking longer than usual. It will appear here when it's ready; you can leave this page and come back."
                : "The AI is rating each skill against the interview transcript. This usually takes under two minutes."
            }
            icon={<Loader2 aria-hidden className="h-6 w-6 animate-spin text-primary" />}
          >
            {view.lastError && (
              <p className="text-xs text-muted-foreground">
                Retrying automatically after a temporary error from the AI service ({view.lastError}).
              </p>
            )}
          </StatePanel>
        )}

        {view.kind === "failed" && (
          <StatePanel
            tone="error"
            title="The portfolio couldn't be generated"
            body={view.reason ? `Reason: ${view.reason}` : "The AI service didn't return a usable result."}
          >
            <Button variant="outline" size="sm" onClick={handleRetry} disabled={retrying}>
              {retrying ? (
                <Loader2 aria-hidden className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw aria-hidden className="mr-1.5 h-3.5 w-3.5" />
              )}
              Generate again
            </Button>
          </StatePanel>
        )}

        {view.kind === "ready" && (
          <div className="space-y-8">
            <EvidenceSummary skills={configured} />

            <section aria-labelledby="configured-skills" className="space-y-3">
              <h2 id="configured-skills" className="text-sm font-semibold">
                Skills in this assessment
              </h2>
              {configured.length === 0 && (
                <p className="text-sm text-muted-foreground">This assessment has no configured skills.</p>
              )}
              {configured.map((skill) => (
                <SkillPortfolioCard key={skill.id} skill={skill} onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)} />
              ))}
            </section>

            {discovered.length > 0 && (
              <section aria-labelledby="discovered-skills" className="space-y-3">
                <div>
                  <h2 id="discovered-skills" className="text-sm font-semibold">
                    Also demonstrated
                  </h2>
                  <p className="text-xs text-muted-foreground">Skills the candidate showed that this assessment didn't ask for.</p>
                </div>
                {discovered.map((skill) => (
                  <SkillPortfolioCard key={skill.id} skill={skill} onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)} />
                ))}
              </section>
            )}

            <section aria-labelledby="compare-vacancy" className="space-y-3 border-t pt-6">
              <h2 id="compare-vacancy" className="text-sm font-semibold">
                Compare with a vacancy
              </h2>
              {vacancies?.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No vacancies yet.{" "}
                  <Link to="/vacancies/new" className="font-medium text-primary underline-offset-2 hover:underline">
                    Create a vacancy
                  </Link>{" "}
                  to compare this candidate against its required levels.
                </p>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select value={selectedVacancy} onValueChange={setSelectedVacancy} disabled={!vacancies}>
                    <SelectTrigger className="sm:w-72" aria-label="Vacancy">
                      <SelectValue placeholder={vacancies ? "Choose a vacancy" : "Loading vacancies…"} />
                    </SelectTrigger>
                    <SelectContent>
                      {vacancies?.map((v) => (
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
                    Open fit/gap report
                  </Button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function EvidenceSummary({ skills }: { skills: PortfolioSkill[] }) {
  if (skills.length === 0) return null;
  const assessed = skills.filter((s) => s.assessed).length;
  const notAssessed = skills.filter((s) => !s.assessed && !s.override);
  const byAssessor = skills.filter((s) => s.override).length;

  return (
    <section aria-label="Evidence summary" className="space-y-3 rounded-lg border p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-base font-semibold">
          <span className="tabular-nums">{assessed}</span> of <span className="tabular-nums">{skills.length}</span> skills
          assessed in the interview
        </p>
        <p className="text-xs text-muted-foreground">
          {[
            notAssessed.length > 0 && `${notAssessed.length} without evidence`,
            byAssessor > 0 && `${byAssessor} rated by an assessor`,
          ]
            .filter(Boolean)
            .join(", ")}
        </p>
      </div>
      <div aria-hidden className="flex gap-1">
        {skills.map((s) => (
          <span
            key={s.id}
            className={cn(
              "h-2 flex-1 rounded-full",
              s.assessed ? "bg-evidence" : s.override ? "bg-evidence/40" : "border border-dashed border-unassessed",
            )}
          />
        ))}
      </div>
      {notAssessed.length > 0 && (
        <p className="text-sm text-muted-foreground">
          "Not assessed" means the interview produced no evidence for that skill, so it has no level. It is not a low
          score. Rate it yourself if you have other evidence.
        </p>
      )}
    </section>
  );
}
