import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillRow from "@/components/portfolio/SkillRow";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { assessmentsApi } from "@/services/assessments";
import { usePolling } from "@/hooks/usePolling";
import { attentionItems, humanDecisionCount, overrideForSkill, pageState, reportBanner } from "@/lib/portfolioReview";
import { cn } from "@/lib/utils";
import type { AssessmentSkill, Portfolio, PortfolioSkill, Vacancy } from "@/types";

/**
 * Candidate portfolio, designed for a non-technical assessor (see design-principles.md):
 * understand in 30 seconds, inspect a doubtful rating in another 30. Calm by default; detail on demand.
 */
export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [waitingForFirst, setWaitingForFirst] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [assessmentSkills, setAssessmentSkills] = useState<AssessmentSkill[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState("");
  const [savingSkillId, setSavingSkillId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<{ skillId: number; message: string } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [showAttention, setShowAttention] = useState(false);
  const [showTopics, setShowTopics] = useState(false);
  const [showTech, setShowTech] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await sessionsApi.getPortfolio(Number(sessionId));
      const data = res.data as { portfolio?: Portfolio; status?: string };
      if (data.portfolio) {
        setPortfolio(data.portfolio);
        setWaitingForFirst(false);
      } else {
        setWaitingForFirst(true); // 202: first scoring still running
      }
      setLoadError(null);
    } catch {
      setLoadError("We couldn't load this report. Check your connection and refresh.");
    }
  }, [sessionId]);

  useEffect(() => {
    Promise.all([
      fetchPortfolio(),
      sessionsApi.get(Number(sessionId)).then((r) => setCandidateName(r.data.session.candidate_name ?? null)),
      assessmentsApi.get(Number(id)).then((r) => setAssessmentSkills(r.data.assessment.skills ?? [])),
      vacanciesApi.list().then((r) => setVacancies(r.data.vacancies)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchPortfolio, id, sessionId]);

  const state = pageState(portfolio, waitingForFirst);
  const inFlight = ["queued", "running", "retrying"].includes(portfolio?.latest_generation?.status ?? "");
  usePolling(fetchPortfolio, 5000, state === "first_scoring" || inFlight);

  const anchorFor = useCallback(
    (label: string) => {
      const skill = assessmentSkills.find((s) => s.skill_label.toLowerCase() === label.toLowerCase());
      return {
        meaning: (level: number) => (skill?.[`l${level}_anchor` as keyof AssessmentSkill] as string | undefined) || undefined,
        expected: skill?.expected_level ?? null,
      };
    },
    [assessmentSkills]
  );

  const saveDecision = async (skill: PortfolioSkill, level: number, notes: string) => {
    setSavingSkillId(skill.id);
    setSaveError(null);
    try {
      await portfoliosApi.getOverride(skill.id, { override_level: level, assessor_notes: notes });
      await fetchPortfolio();
    } catch {
      setSaveError({ skillId: skill.id, message: "Your decision wasn't saved. Please try again." });
    } finally {
      setSavingSkillId(null);
    }
  };

  const retryScoring = async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      await sessionsApi.regeneratePortfolio(Number(sessionId));
      setWaitingForFirst(true);
      await fetchPortfolio();
    } catch (e: any) {
      setRetryError(e?.response?.data?.errors?.[0]?.message ?? "Scoring couldn't be started. Please try again.");
    } finally {
      setRetrying(false);
    }
  };

  const exportJson = async () => {
    if (!portfolio) return;
    setExportError(null);
    try {
      const res = await portfoliosApi.exportPortfolio(portfolio.id, "json", selectedVacancy ? Number(selectedVacancy) : undefined);
      const url = URL.createObjectURL(new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `portfolio-${sessionId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Export failed. Please try again.");
    }
  };

  const items = useMemo(() => (portfolio ? attentionItems(portfolio) : []), [portfolio]);
  const transcriptHref = `/assessments/${id}/sessions/${sessionId}/transcript`;
  const name = candidateName || "Candidate";

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const header = (subtitle: string) => (
    <div className="flex items-start gap-3">
      <Link to={`/assessments/${id}/invite`} aria-label="Back to candidates" className="mt-1.5 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold break-words">{name}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );

  if (loadError && !portfolio) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {header("Interview report")}
        <p className="text-sm text-destructive">{loadError}</p>
        <Button size="sm" variant="outline" onClick={fetchPortfolio}>Try again</Button>
      </div>
    );
  }

  if (state === "first_scoring") {
    const retryingLatest = portfolio?.latest_generation?.status === "retrying";
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header("Interview report · scoring in progress")}
        <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-4">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          <div className="text-sm">
            <p className="font-medium">Scoring the interview…</p>
            <p className="text-muted-foreground">
              {retryingLatest
                ? "The scoring service had a temporary problem. We're retrying automatically; you don't need to do anything."
                : "This usually takes under a minute. This page updates by itself."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state === "first_failed" && portfolio) {
    const elig = portfolio.regenerate;
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header("Interview report · not scored yet")}
        <div className="space-y-3">
          <p className="font-medium">This interview hasn't been scored yet.</p>
          <p className="text-sm text-muted-foreground">
            {elig?.reason === "needs_admin"
              ? "The scoring service isn't configured correctly for this account. An administrator needs to fix it before scoring can be retried. The transcript is safe."
              : "The scoring service had a problem and automatic retries ran out. The transcript is safe."}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {elig?.allowed && (
              <Button onClick={retryScoring} disabled={retrying}>
                {retrying ? "Starting…" : "Retry scoring"}
              </Button>
            )}
            <Link to={transcriptHref} className="text-sm text-primary underline-offset-2 hover:underline">View transcript</Link>
          </div>
          {retryError && <p className="text-sm text-destructive">{retryError}</p>}
        </div>
      </div>
    );
  }

  if (!portfolio) return null;
  const banner = reportBanner(portfolio);
  // Same order the assessor configured the skills in.
  const order = (label: string) => {
    const i = assessmentSkills.findIndex((a) => a.skill_label.toLowerCase() === label.toLowerCase());
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const assessed = portfolio.skills.filter((s) => !s.is_discovered).sort((a, b) => order(a.skill_label) - order(b.skill_label));
  const topics = portfolio.skills.filter((s) => s.is_discovered);
  const earlier = portfolio.overrides.filter((o) => o.orphaned);
  const decisions = humanDecisionCount(portfolio);
  const generatedAt = portfolio.current_generation?.finished_at ?? portfolio.generated_at;

  return (
    <div className="mx-auto max-w-3xl">
      {header(`Interview report${generatedAt ? ` · ${new Date(generatedAt).toLocaleDateString()}` : ""}`)}

      <p className="mt-3 text-sm text-muted-foreground">
        {assessed.length} {assessed.length === 1 ? "skill" : "skills"} assessed · {decisions} {decisions === 1 ? "decision" : "decisions"} by you
        {items.length > 0 && <> · {items.length} {items.length === 1 ? "item needs" : "items need"} attention</>}
      </p>

      {banner && (
        <div className={cn("mt-4 rounded-md px-3 py-2 text-sm", banner.kind === "rescoring" ? "bg-muted/60" : "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200")} role="status">
          {banner.text}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowAttention((v) => !v)}
            aria-expanded={showAttention}
            className="flex items-center gap-2 text-sm"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            {items.length} {items.length === 1 ? "item needs" : "items need"} your attention
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showAttention && "rotate-180")} />
          </button>
          {showAttention && (
            <ul className="mt-2 space-y-1.5 rounded-md bg-amber-50/70 p-3 text-sm dark:bg-amber-950/30">
              {items.map((it, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                  <span className={it.tier === "gap" ? "text-muted-foreground" : ""}>{it.text}</span>
                  <a
                    href={`#${it.targetId}`}
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(it.targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    Review
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <h2 className="mt-8 mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Assessed skills</h2>
      {assessed.map((skill) => {
        const a = anchorFor(skill.skill_label);
        return (
          <SkillRow
            key={skill.id}
            skill={skill}
            override={overrideForSkill(portfolio, skill)}
            levelMeaning={a.meaning}
            roleExpectation={a.expected}
            transcriptHref={transcriptHref}
            saving={savingSkillId === skill.id}
            error={saveError?.skillId === skill.id ? saveError.message : null}
            onSaveDecision={saveDecision}
          />
        );
      })}

      {earlier.length > 0 && (
        <section id="earlier-decisions" className="mt-6 scroll-mt-20">
          <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Earlier decisions</h2>
          {earlier.map((o) => (
            <div key={o.id} className="border-t py-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-medium">{o.skill_label} <span className="font-normal text-muted-foreground">· no longer in this report</span></span>
                <span className="shrink-0 text-muted-foreground">Your decision L{o.override_level}</span>
              </div>
              <p className="text-muted-foreground">Kept for the record. It isn't applied to any other skill.</p>
            </div>
          ))}
        </section>
      )}

      {topics.length > 0 && (
        <section className="mt-6">
          <button type="button" onClick={() => setShowTopics((v) => !v)} aria-expanded={showTopics} className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Also came up in the interview ({topics.length})
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showTopics && "rotate-180")} />
          </button>
          {showTopics && topics.map((t) => {
            const notFound = (t.evidence_checks ?? []).some((c) => c.status === "not_found");
            return (
              <div key={t.id} className="border-t py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="font-medium">{t.skill_label} <span className="font-normal text-muted-foreground">· not part of this assessment</span></span>
                  <span className="shrink-0 text-muted-foreground">{t.ai_level ? `AI suggested L${t.ai_level}` : "Not rated"}</span>
                </div>
                {notFound && <p className="text-amber-700 dark:text-amber-400">A cited excerpt wasn't found in the transcript. Don't treat it as candidate evidence.</p>}
              </div>
            );
          })}
        </section>
      )}

      <section className="mt-10 flex flex-wrap items-center gap-3 border-t pt-6">
        <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Compare with a vacancy…" /></SelectTrigger>
          <SelectContent>
            {vacancies.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.role_title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" disabled={!selectedVacancy} onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/fitgap/${selectedVacancy}`)}>
          Fit/gap report
        </Button>
        <Button variant="ghost" onClick={exportJson}><Download className="mr-1 h-4 w-4" />Export</Button>
        <Link to={transcriptHref} className="text-sm text-primary underline-offset-2 hover:underline">Transcript</Link>
        {exportError && <p className="w-full text-sm text-destructive">{exportError}</p>}
      </section>

      <section className="mt-6 mb-10">
        <button type="button" onClick={() => setShowTech((v) => !v)} aria-expanded={showTech} className="flex items-center gap-1 text-xs text-muted-foreground">
          Technical details <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showTech && "rotate-180")} />
        </button>
        {showTech && portfolio.current_generation && (
          <p className="mt-2 text-xs text-muted-foreground">
            Report #{portfolio.current_generation.sequence} · model {portfolio.current_generation.served_model ?? "unknown"} (as reported by provider; requested {portfolio.current_generation.requested_model ?? "unknown"}) · prompt {portfolio.current_generation.prompt_version ?? "unknown"}
            {portfolio.latest_generation && portfolio.latest_generation.id !== portfolio.current_generation.id &&
              ` · latest attempt #${portfolio.latest_generation.sequence}: ${portfolio.latest_generation.status}${portfolio.latest_generation.error_code ? ` (${portfolio.latest_generation.error_code})` : ""}`}
          </p>
        )}
      </section>
    </div>
  );
}
