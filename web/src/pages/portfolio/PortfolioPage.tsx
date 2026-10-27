import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { assessmentsApi } from "@/services/assessments";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import PageHeader from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import PageSkeleton, { PageHeaderSkeleton } from "@/components/layout/PageSkeleton";
import PageTransition from "@/components/layout/PageTransition";
import { Notice } from "@/components/motion/Notice";
import { Download, Loader2, FileText } from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy, AssessmentSkill, PortfolioSkill } from "@/types";
import ErrorState from "@/components/feedback/ErrorState";
import EmptyState from "@/components/feedback/EmptyState";

const normalizeLabel = (label: string) => label.trim().toLowerCase();

/** Configured skills the interview never reached: the generator stores no row for them. */
export function unreachedSkills(configured: AssessmentSkill[], rated: PortfolioSkill[]): AssessmentSkill[] {
  const ratedIds = new Set(rated.map((s) => s.skill_id).filter((v) => v != null));
  const ratedLabels = new Set(rated.map((s) => normalizeLabel(s.skill_label)));
  return configured.filter(
    (c) => !(c.skill_id != null && ratedIds.has(c.skill_id)) && !ratedLabels.has(normalizeLabel(c.skill_label)),
  );
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
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [configuredSkills, setConfiguredSkills] = useState<AssessmentSkill[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [retryError, setRetryError] = useState(false);
  const [overrideChanged, setOverrideChanged] = useState(false);

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
    setLoading(true);
    setLoadError(false);
    // The configured skill list only feeds the "not reached" section; losing it must not block the page.
    assessmentsApi
      .get(Number(id))
      .then((res) => setConfiguredSkills(res.data.assessment.skills ?? []))
      .catch(() => setConfiguredSkills([]));
    Promise.all([fetchPortfolio(), vacanciesApi.list(), sessionsApi.get(Number(sessionId))])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data.vacancies);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [fetchPortfolio, id, sessionId]);

  useEffect(load, [load]);

  // Poll while generating
  usePolling(fetchPortfolio, 5000, generating);

  const handleOverrideSaved = (skillId: number, override: AssessorOverride) => {
    setOverrides((prev) => ({ ...prev, [skillId]: override }));
    setOverrideChanged(true);
  };

  const handleRetryGeneration = async () => {
    setRetryError(false);
    try {
      await sessionsApi.regeneratePortfolio(Number(sessionId));
      setGenerating(true);
    } catch {
      setRetryError(true);
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
      <PageSkeleton label="portfolio">
        <PageHeaderSkeleton actions={3} />
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-14 w-14" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </PageSkeleton>
    );
  }

  if (loadError) {
    return (
      <ErrorState message="Could not load this candidate's portfolio. Check your connection, then try again." onRetry={load}>
        <Button asChild variant="ghost" size="sm">
          <Link to={`/assessments/${id}/invite`}>Back to sessions</Link>
        </Button>
      </ErrorState>
    );
  }

  const notReached = portfolio?.generation_status === "complete" ? unreachedSkills(configuredSkills, portfolio.skills) : [];

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <PageHeader
        backTo={`/assessments/${id}/invite`}
        backLabel="Assessment Sessions"
        title="Candidate portfolio"
        subtitle={candidateName ?? undefined}
      >
        <Button asChild variant="outline" size="sm">
          <Link to={`/assessments/${id}/sessions/${sessionId}/transcript`}>
            <FileText className="h-3.5 w-3.5" />
            Transcript
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
      </PageHeader>

      {/* Generating state */}
      {generating && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <div>
            <p className="font-medium">Generating portfolio...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Rating each skill from the interview transcript. This usually takes about 2 minutes; the page updates by itself.
            </p>
          </div>
        </div>
      )}

      {/* Failed state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <ErrorState
          message={
            <>
              The portfolio could not be generated. No ratings were saved, so nothing is half-finished. Generating again reuses the same transcript.
              {retryError && <span className="mt-1 block text-red-700">The retry could not be queued. Try again in a moment.</span>}
            </>
          }
          onRetry={handleRetryGeneration}
          retryLabel="Generate again"
        />
      )}

      {/* Empty / Not ready state */}
      {!generating && (!portfolio || (portfolio.generation_status !== "complete" && portfolio.generation_status !== "failed")) && (
        <EmptyState
          title="Portfolio not available yet"
          description="This candidate session does not have a completed portfolio yet. A portfolio is generated automatically after the interview session concludes."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to={`/assessments/${id}/invite`}>Back to candidate list</Link>
            </Button>
          }
        />
      )}

      {/* Ready state */}
      {!generating && portfolio?.generation_status === "complete" && (
        <>
          {/* Configured skills */}
          <section aria-labelledby="configured-heading" className="space-y-3">
            <div>
              <h2 id="configured-heading" className="text-sm font-semibold">Assessed skills</h2>
              <p className="text-xs text-muted-foreground">
                AI ratings from the interview. Override any rating you disagree with; the override is kept if the portfolio is regenerated.
              </p>
            </div>
            {portfolio.skills.filter((s) => !s.is_discovered).length === 0 && (
              <EmptyState
                title="No configured skill was reached"
                description="The interview ended before any configured skill came up, so there is nothing to rate. See the list below and probe them in a follow-up round."
              />
            )}
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
          </section>

          {/* Configured skills with no rating */}
          {notReached.length > 0 && (
            <section aria-labelledby="unreached-heading" className="rounded-lg border border-dashed p-4 space-y-2">
              <h2 id="unreached-heading" className="text-sm font-semibold">Not reached in the interview</h2>
              <p className="text-xs text-muted-foreground">
                These skills have no rating. They show as "Not assessed" in fit/gap reports, not as gaps. Probe them in a follow-up round.
              </p>
              <ul className="flex flex-wrap gap-2">
                {notReached.map((s) => (
                  <li key={s.skill_id ?? s.skill_label} className="text-sm rounded-md bg-muted px-2.5 py-1 break-words max-w-full">
                    {s.skill_label}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Discovered skills */}
          {portfolio.skills.some((s) => s.is_discovered) && (
            <section aria-labelledby="discovered-heading" className="space-y-3">
              <div>
                <h2 id="discovered-heading" className="text-sm font-semibold">Also came up in the interview</h2>
                <p className="text-xs text-muted-foreground">
                  Skills the candidate showed that this assessment did not ask about.
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
            </section>
          )}

          <Separator />

          {/* Fit/Gap */}
          <section aria-labelledby="compare-heading" className="space-y-3">
            <div>
              <h2 id="compare-heading" className="text-sm font-semibold">Compare with a vacancy</h2>
              <p className="text-xs text-muted-foreground">
                The fit/gap report uses the levels above, including your overrides.
              </p>
            </div>
            <Notice show={overrideChanged}>
              <p role="status" className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                You changed a rating. Reports generated earlier still use the old level and will ask you to regenerate.
              </p>
            </Notice>
            {vacancies.length === 0 ? (
              <EmptyState
                title="No vacancies yet"
                description="A fit/gap report compares this candidate against a vacancy's required levels."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link to="/vacancies/new">Create a vacancy</Link>
                  </Button>
                }
              />
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                  <SelectTrigger className="w-full sm:w-64 min-h-11 sm:min-h-9" aria-label="Vacancy">
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
                <Button onClick={handleRunFitGap} disabled={!selectedVacancy} className="w-full sm:w-auto min-h-11 sm:min-h-9">
                  Open fit/gap report
                </Button>
              </div>
            )}
          </section>
        </>
      )}
    </PageTransition>
  );
}
