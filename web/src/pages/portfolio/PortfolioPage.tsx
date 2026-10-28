import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { downloadPortfolioExport } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { apiErrorMessage } from "@/lib/apiError";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, FileText } from "lucide-react";
import type { Portfolio, AssessorOverride, PortfolioSkill, Vacancy } from "@/types";

type Phase = "loading" | "generating" | "ready" | "failed" | "error";

function coverageSummary(skills: PortfolioSkill[]) {
  const count = (status: PortfolioSkill["assessment_status"]) => skills.filter((s) => s.assessment_status === status).length;
  const parts = [`${count("assessed")} of ${skills.length} skills assessed`];
  if (count("not_assessed")) parts.push(`${count("not_assessed")} not discussed in the interview`);
  if (count("needs_review")) parts.push(`${count("needs_review")} need review`);
  return parts.join(" · ");
}

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await sessionsApi.getPortfolio(Number(sessionId));
      const p = (res.data as { portfolio?: Portfolio | null }).portfolio ?? null;
      setPortfolio(p);
      setLoadError(null);
      if (res.status === 202 || !p || p.generation_status === "pending" || p.generation_status === "generating") {
        setPhase("generating");
      } else if (p.generation_status === "failed") {
        setPhase("failed");
      } else {
        setOverrides(Object.fromEntries(p.overrides.map((o) => [o.portfolio_skill_id, o])));
        setPhase("ready");
      }
    } catch (e) {
      setLoadError(apiErrorMessage(e, "Could not load the portfolio."));
      setPhase("error");
    }
  }, [sessionId]);

  useEffect(() => {
    fetchPortfolio();
    sessionsApi
      .get(Number(sessionId))
      .then((res) => setCandidateName(res.data.session.candidate_name ?? null))
      .catch(() => {}); // The name is decoration; the page works without it.
    vacanciesApi
      .list()
      .then((res) => setVacancies(res.data.vacancies))
      .catch(() => setVacancies([]));
  }, [fetchPortfolio, sessionId]);

  usePolling(fetchPortfolio, 5000, phase === "generating" && !portfolio?.stale);

  const handleRetry = async () => {
    setActionError(null);
    try {
      await sessionsApi.regeneratePortfolio(Number(sessionId));
      await fetchPortfolio();
    } catch (e) {
      setActionError(apiErrorMessage(e, "Could not restart generation. Try again."));
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setActionError(null);
    try {
      await downloadPortfolioExport(
        portfolio.id,
        format,
        `portfolio-${sessionId}.${format}`,
        selectedVacancy ? Number(selectedVacancy) : undefined
      );
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setExporting(null);
    }
  };

  const renderSkills = (skills: PortfolioSkill[]) =>
    skills.map((skill) => (
      <SkillPortfolioCard
        key={skill.id}
        skill={skill}
        override={overrides[skill.id]}
        onOverrideSaved={(o) => setOverrides((prev) => ({ ...prev, [skill.id]: o }))}
      />
    ));

  if (phase === "loading") {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const configured = portfolio?.skills.filter((s) => !s.is_discovered) ?? [];
  const discovered = portfolio?.skills.filter((s) => s.is_discovered) ?? [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link to={`/assessments/${id}/invite`} className="text-muted-foreground hover:text-foreground" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">Portfolio Results</h1>
            {candidateName && <p className="text-sm text-muted-foreground break-words">{candidateName}</p>}
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
          {phase === "ready" &&
            (["pdf", "json"] as const).map((format) => (
              <Button key={format} variant="outline" size="sm" onClick={() => handleExport(format)} disabled={!!exporting}>
                {exporting === format ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1" />
                )}
                {format.toUpperCase()}
              </Button>
            ))}
        </div>
      </div>

      {actionError && <Notice tone="error">{actionError}</Notice>}

      {phase === "error" && (
        <Notice tone="error" action={<Button size="sm" variant="outline" onClick={fetchPortfolio}>Try again</Button>}>
          {loadError}
        </Notice>
      )}

      {phase === "generating" &&
        (portfolio?.stale ? (
          <Notice tone="warning" action={<Button size="sm" variant="outline" onClick={handleRetry}>Retry</Button>}>
            This is taking much longer than expected.
          </Notice>
        ) : (
          <div className="border rounded-lg p-10 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="font-medium">Generating the portfolio</p>
            <p className="text-sm text-muted-foreground">
              {portfolio && portfolio.generation_attempts > 1 && portfolio.generation_error
                ? `Attempt ${portfolio.generation_attempts}. Last attempt: ${portfolio.generation_error}`
                : "You can leave this page; the portfolio is saved when it is ready."}
            </p>
          </div>
        ))}

      {phase === "failed" && (
        <div className="border border-destructive/40 rounded-lg p-6 text-center space-y-3">
          <p className="text-sm font-medium text-destructive">Portfolio generation failed.</p>
          {portfolio?.generation_error && <p className="text-sm text-muted-foreground">{portfolio.generation_error}</p>}
          <Button variant="outline" size="sm" onClick={handleRetry}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      )}

      {phase === "ready" && portfolio && (
        <>
          {portfolio.skills.length > 0 && portfolio.skills.every((s) => s.assessment_status === "not_assessed") && (
            <Notice
              tone="warning"
              action={<Link to={`/assessments/${id}/invite`} className="text-sm font-medium underline">Invite again</Link>}
            >
              No skill was discussed in this interview, so none can be rated. If the session was cut short, for
              example by a connection problem, invite the candidate to a new session.
            </Notice>
          )}

          {portfolio.skills.length === 0 ? (
            <p className="text-sm text-muted-foreground border rounded-lg p-6 text-center">
              This assessment has no skills, so there is nothing to rate.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{coverageSummary(portfolio.skills)}</p>
          )}

          {configured.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Configured Skills</h2>
              {renderSkills(configured)}
            </div>
          )}

          {discovered.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Discovered Skills
                  </h2>
                  <p className="text-xs text-muted-foreground">Came up in the interview but were not part of the assessment.</p>
                </div>
                {renderSkills(discovered)}
              </div>
            </>
          )}

          <Separator />

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder={vacancies.length ? "Choose vacancy..." : "No vacancies yet"} />
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
              Run Fit/Gap Analysis
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
