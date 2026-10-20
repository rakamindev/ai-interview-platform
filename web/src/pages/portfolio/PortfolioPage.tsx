import { useEffect, useState, useCallback } from "react";
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
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";

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

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-5 border-b pb-6">
        <Link to={`/assessments/${id}/invite`} className="inline-flex min-h-11 items-center gap-2 rounded-md pr-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Candidates
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">Candidate results</h1>
            {candidateName ? <p className="text-base text-muted-foreground">{candidateName}</p> : <p className="text-sm text-muted-foreground">Interview assessment summary</p>}
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <FileText aria-hidden="true" className="h-4 w-4" />
            Transcript
          </Link>
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
          {/* Configured skills */}
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Assessment skills</h2>
              <p className="mt-1 text-sm text-muted-foreground">Evidence and assessor adjustments for the skills in this interview plan.</p>
            </div>
            {portfolio.skills.filter((s) => !s.is_discovered).length === 0 ? (
              <div className="rounded-xl border bg-card px-5 py-8 text-sm text-muted-foreground">No assessment skills were included in this interview.</div>
            ) : portfolio.skills
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

          {/* Discovered skills */}
          {portfolio.skills.some((s) => s.is_discovered) && (
            <>
              <section className="space-y-4 border-t pt-7">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-semibold">
                    <Zap aria-hidden="true" className="h-4 w-4 text-amber-700" />
                    Discovered Skills
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
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
              </section>
            </>
          )}

          <section className="space-y-4 rounded-xl border bg-card p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-semibold">Compare with a vacancy</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">See how this candidate’s assessed skills align with a role’s requirements.</p>
            </div>
            {vacancies.length === 0 ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">There are no active vacancies to compare against.</p>
                <Button asChild variant="outline" className="min-h-11">
                  <Link to="/vacancies/new">Create a vacancy</Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-2">
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
                <Button className="min-h-11 w-full sm:w-auto" onClick={handleRunFitGap} disabled={!selectedVacancy}>
                  Compare with vacancy
                </Button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
