import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseLevel, LEVEL_BAR_CLASSES } from "@/utils/constants";
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds < 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface StatProps {
  label: string;
  value: number;
  tone?: "default" | "warn";
}

function Stat({ label, value, tone = "default" }: StatProps) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-2xl font-semibold tabular-nums",
          tone === "warn" && value > 0 && "text-amber-800"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [interview, setInterview] = useState<{
    assessment: string | null;
    startedAt: string | null;
    duration: number | null;
    status: string | null;
  }>({ assessment: null, startedAt: null, duration: null, status: null });

  const fetchPortfolio = useCallback(async () => {
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    const data = res.data as any;
    if (data.status === "generating" || data.portfolio?.generation_status === "generating" || data.portfolio?.generation_status === "pending") {
      setGenerating(true);
    } else if (data.portfolio) {
      setPortfolio(data.portfolio);
      setGenerating(false);
      const overrideMap: Record<number, AssessorOverride> = {};
      data.portfolio.overrides.forEach((o: AssessorOverride) => {
        overrideMap[o.portfolio_skill_id] = o;
      });
      setOverrides(overrideMap);
    }
  }, [sessionId]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [, vRes, sRes] = await Promise.all([
        fetchPortfolio(),
        vacanciesApi.list({ status: "active" }),
        sessionsApi.get(Number(sessionId)),
      ]);
      setVacancies(vRes.data.vacancies);
      setCandidateName(sRes.data.session.candidate_name ?? null);
      setInterview({
        assessment:
          (sRes.data.session as any).assessment?.name ?? sRes.data.assessment?.name ?? null,
        startedAt: sRes.data.session.started_at ?? null,
        duration: sRes.data.session.duration_seconds ?? null,
        status: sRes.data.session.status ?? null,
      });
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [fetchPortfolio, sessionId]);

  useEffect(() => { loadPage(); }, [loadPage]);

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

  const assessedSkills = useMemo(
    () => portfolio?.skills.filter((s) => !s.is_discovered) ?? [],
    [portfolio]
  );
  const discoveredSkills = useMemo(
    () => portfolio?.skills.filter((s) => s.is_discovered) ?? [],
    [portfolio]
  );
  const levelCounts = useMemo(
    () =>
      [1, 2, 3, 4, 5].map(
        (level) =>
          assessedSkills.filter(
            (s) => (overrides[s.id]?.override_level ?? parseLevel(s.ai_level)) === level
          ).length
      ),
    [assessedSkills, overrides]
  );
  const averageLevel = assessedSkills.length
    ? assessedSkills.reduce(
        (sum, s) => sum + (overrides[s.id]?.override_level ?? parseLevel(s.ai_level)),
        0
      ) / assessedSkills.length
    : 0;
  const lowConfidence = assessedSkills.filter(
    (s) => s.ai_confidence?.toLowerCase() === "low"
  ).length;
  const overrideCount = Object.keys(overrides).length;

  const confidenceSentence = !assessedSkills.length
    ? "No skills were assessed in this interview."
    : lowConfidence === assessedSkills.length
      ? "Every rating is low confidence. Treat this result as provisional and consider a follow-up session."
      : lowConfidence > 0
        ? `${lowConfidence} of ${assessedSkills.length} ratings are low confidence. Review them before deciding.`
        : "All ratings are medium or high confidence.";

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div role="alert" className="mx-auto max-w-3xl space-y-3 rounded-xl border bg-white p-6">
        <div>
          <h1 className="font-semibold">Candidate results could not be loaded</h1>
          <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
        </div>
        <Button variant="outline" className="min-h-11" onClick={loadPage}>Try again</Button>
        <Button asChild variant="ghost"><Link to={`/assessments/${id}/invite`}>Back to candidates</Link></Button>
      </div>
    );
  }

  const metaLine = [
    interview.assessment,
    formatDate(interview.startedAt),
    formatDuration(interview.duration),
  ].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-4">
        <Link to={`/assessments/${id}/invite`} className="inline-flex min-h-11 items-center gap-2 rounded-md pr-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Candidates
        </Link>
        <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">
              {candidateName || "Candidate results"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {candidateName ? (metaLine || "Interview assessment summary") : "Interview assessment summary"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <Button asChild variant="outline" className="min-h-11">
              <Link to={`/assessments/${id}/sessions/${sessionId}/transcript`}>
                <FileText aria-hidden="true" className="mr-1.5 h-4 w-4" />
                Transcript
              </Link>
            </Button>
            {!generating && portfolio && (
              <>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => handleExport("pdf")}
                  disabled={!!exporting}
                >
                  {exporting === "pdf" ? <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" /> : <Download aria-hidden="true" className="mr-1.5 h-4 w-4" />}
                  Export PDF
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => handleExport("json")}
                  disabled={!!exporting}
                >
                  {exporting === "json" ? <Loader2 aria-hidden="true" className="mr-1.5 h-4 w-4 animate-spin" /> : <Download aria-hidden="true" className="mr-1.5 h-4 w-4" />}
                  Export JSON
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Generating state */}
      {generating && (
        <div role="status" className="space-y-3 rounded-xl border bg-card px-6 py-12 text-center">
          <Loader2 aria-hidden="true" className="mx-auto h-8 w-8 animate-spin text-primary" />
          <div>
            <p className="font-medium">Generating portfolio...</p>
            <p className="mt-1 text-sm text-muted-foreground">The interview responses are being analyzed. Results will appear here when ready.</p>
          </div>
        </div>
      )}

      {/* Failed state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <div role="alert" className="space-y-3 rounded-xl border border-destructive/40 bg-card p-6 text-center">
          <p className="text-sm text-destructive">Portfolio generation failed.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await sessionsApi.regeneratePortfolio(Number(sessionId));
              setGenerating(true);
            }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      )}

      {/* Ready state */}
      {!generating && portfolio?.generation_status === "complete" && (
        <>
          {/* At-a-glance summary */}
          <section aria-labelledby="summary-heading" className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 id="summary-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Summary
                </h2>
                <p className="mt-1.5 text-2xl font-semibold tracking-tight">
                  L{averageLevel.toFixed(1)}
                  <span className="ml-2 text-base font-normal text-muted-foreground">average level</span>
                </p>
                <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{confidenceSentence}</p>
              </div>
              <div className="w-full space-y-2 sm:w-64">
                <ul className="grid grid-cols-5 gap-1.5">
                  {levelCounts.map((count, index) => (
                    <li
                      key={index}
                      className={cn(
                        "rounded-md border bg-card px-1 py-1.5 text-center",
                        count === 0 && "opacity-50"
                      )}
                    >
                      <span
                        className={cn("mx-auto mb-1 block h-1 w-5 rounded-full", LEVEL_BAR_CLASSES[index + 1])}
                        aria-hidden="true"
                      />
                      <span className="block text-base font-semibold tabular-nums">{count}</span>
                      <span className="block text-[10px] text-muted-foreground">L{index + 1}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">Skills per level</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
              <Stat label="Skills assessed" value={assessedSkills.length} />
              <Stat label="Low confidence" value={lowConfidence} tone="warn" />
              <Stat label="Discovered" value={discoveredSkills.length} />
              <Stat label="Your overrides" value={overrideCount} />
            </dl>
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0 space-y-8">
              {/* Configured skills */}
              <section className="space-y-3" aria-labelledby="assessed-skills-heading">
                <div>
                  <h2 id="assessed-skills-heading" className="text-lg font-semibold">Assessment skills</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {assessedSkills.length} skill{assessedSkills.length === 1 ? "" : "s"} from this interview plan, with evidence and your adjustments.
                  </p>
                </div>
                {assessedSkills.length === 0 ? (
                  <div className="rounded-xl border bg-card px-5 py-8 text-sm text-muted-foreground">No assessment skills were included in this interview.</div>
                ) : (
                  assessedSkills.map((skill) => (
                    <SkillPortfolioCard
                      key={skill.id}
                      skill={skill}
                      override={overrides[skill.id]}
                      onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                    />
                  ))
                )}
              </section>

              {/* Discovered skills */}
              {discoveredSkills.length > 0 && (
                <section className="space-y-3 border-t pt-7" aria-labelledby="discovered-skills-heading">
                  <div>
                    <h2 id="discovered-skills-heading" className="flex items-center gap-2 text-lg font-semibold">
                      <Zap aria-hidden="true" className="h-4 w-4 text-amber-700" />
                      Discovered skills
                    </h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Skills the AI probed that were not in the original assessment.
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
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <section aria-labelledby="fit-gap-heading" className="space-y-3 rounded-xl border bg-card p-5">
                <div>
                  <h2 id="fit-gap-heading" className="font-semibold">Compare with a vacancy</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    See how these skills align with a role&rsquo;s requirements.
                  </p>
                </div>
                {vacancies.length === 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">There are no active vacancies to compare against.</p>
                    <Button asChild variant="outline" className="min-h-11 w-full">
                      <Link to="/vacancies/new">Create a vacancy</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label htmlFor="fit-gap-vacancy" className="text-sm font-medium">Vacancy</label>
                      <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                        <SelectTrigger id="fit-gap-vacancy" className="w-full">
                          <SelectValue placeholder="Select a vacancy" />
                        </SelectTrigger>
                        <SelectContent>
                          {vacancies.map((v) => (
                            <SelectItem key={v.id} value={String(v.id)}>
                              {v.role_title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="min-h-11 w-full" onClick={handleRunFitGap} disabled={!selectedVacancy}>
                      Compare with vacancy
                    </Button>
                  </div>
                )}
              </section>

              <section aria-labelledby="details-heading" className="rounded-xl border bg-card p-5">
                <h2 id="details-heading" className="font-semibold">Interview details</h2>
                <dl className="mt-3 space-y-2.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Assessment</dt>
                    <dd className="text-right font-medium">{interview.assessment ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Interviewed</dt>
                    <dd className="text-right font-medium">{formatDate(interview.startedAt) ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Duration</dt>
                    <dd className="text-right font-medium">{formatDuration(interview.duration) ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd className="text-right font-medium">
                      {interview.status === "ended" ? "Completed" : interview.status ?? "—"}
                    </dd>
                  </div>
                </dl>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
