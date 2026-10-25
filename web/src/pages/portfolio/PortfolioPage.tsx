import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, CheckCircle2, Download, Eye, FileText, Loader2, RefreshCw, UserRound, Zap } from "lucide-react";
import type { Portfolio, PortfolioRevision, AssessorOverride, Vacancy } from "@/types";

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
  const [revisions, setRevisions] = useState<PortfolioRevision[]>([]);
  const [selectedRevision, setSelectedRevision] = useState<PortfolioRevision | null>(null);

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
      data.portfolio.overrides.filter((o: AssessorOverride) => o.override_level !== o.ai_level).forEach((o: AssessorOverride) => {
        overrideMap[o.portfolio_skill_id] = o;
      });
      setOverrides(overrideMap);
    }
  }, [sessionId]);

  useEffect(() => {
    Promise.all([fetchPortfolio(), vacanciesApi.list(), sessionsApi.get(Number(sessionId))])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data.vacancies);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  useEffect(() => {
    if (!portfolio) return;
    sessionsApi.getPortfolioHistory(Number(sessionId))
      .then((res) => setRevisions(res.data.revisions))
      .catch(() => {});
  }, [portfolio, sessionId, generating]);

  // Poll while generating
  usePolling(fetchPortfolio, 5000, generating);

  const handleOverrideSaved = (skillId: number, override: AssessorOverride | null) => {
    if (selectedRevision) return;
    setOverrides((prev) => {
      if (override && override.override_level !== override.ai_level) return { ...prev, [skillId]: override };
      const next = { ...prev };
      delete next[skillId];
      return next;
    });
  };

  const displayedSkills = selectedRevision?.snapshot.skills ?? portfolio?.skills ?? [];
  const displayedOverrides = selectedRevision?.snapshot.overrides ?? Object.values(overrides);

  const handleRunFitGap = () => {
    if (!selectedVacancy || !portfolio) return;
    const revisionQuery = selectedRevision ? `?portfolio_revision_id=${selectedRevision.id}` : "";
    navigate(`/assessments/${id}/sessions/${sessionId}/fitgap/${selectedVacancy}${revisionQuery}`);
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        selectedVacancy ? Number(selectedVacancy) : undefined,
        selectedRevision?.id
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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <Link to={`/assessments/${id}/invite`} aria-label="Back to candidates" className="mt-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-primary">Candidate results</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Portfolio results</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {candidateName && <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><UserRound className="h-3.5 w-3.5" />{candidateName}</span>}
              {portfolio?.generation_status === "complete" && <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-600"><CheckCircle2 className="h-3.5 w-3.5" />Complete</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex items-center gap-1 text-sm border rounded-md px-3 py-1.5 hover:bg-accent transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Transcript
          </Link>
          {!generating && portfolio && (
            <>
              {portfolio.generation_status === "complete" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await sessionsApi.regeneratePortfolio(Number(sessionId));
                    setGenerating(true);
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerate
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={!!exporting}>
                    {exporting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                    Download
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("pdf")}>
                    Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("json")}>
                    Download JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

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

      {/* Failed state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <div className="border border-destructive/40 rounded-lg p-6 text-center space-y-3">
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
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
          <main className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Skills assessed</p><p className="mt-1 text-2xl font-semibold">{displayedSkills.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Discovered skills</p><p className="mt-1 text-2xl font-semibold">{displayedSkills.filter((skill) => skill.is_discovered).length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Assessor overrides</p><p className="mt-1 text-2xl font-semibold">{displayedOverrides.length}</p></CardContent></Card>
          </div>

          {/* Configured skills */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold">Configured skills <span className="font-normal text-muted-foreground">({displayedSkills.filter((s) => !s.is_discovered).length})</span></h2>
            {displayedSkills
              .filter((s) => !s.is_discovered)
              .map((skill) => (
                <SkillPortfolioCard
                  key={skill.id}
                  skill={skill}
                  override={displayedOverrides.find((override) => override.portfolio_skill_id === skill.id)}
                  onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                  readOnly={!!selectedRevision}
                />
              ))}
          </div>

          {/* Discovered skills */}
          {displayedSkills.some((s) => s.is_discovered) && (
            <>
              <Separator />
              <div className="space-y-3">
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Discovered Skills
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Skills the AI probed that were not in the original assessment
                  </p>
                </div>
                {displayedSkills
                  .filter((s) => s.is_discovered)
                  .map((skill) => (
                    <SkillPortfolioCard
                      key={skill.id}
                      skill={skill}
                      override={displayedOverrides.find((override) => override.portfolio_skill_id === skill.id)}
                      onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                      readOnly={!!selectedRevision}
                    />
                  ))}
              </div>
            </>
          )}

          <Separator />
          </main>

          <aside className="space-y-6 lg:sticky lg:top-6">
          {revisions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Portfolio history</h2>
                {selectedRevision && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedRevision(null)}>
                    View current
                  </Button>
                )}
              </div>
              <div className="border rounded-lg divide-y">
                {revisions.map((revision) => (
                  <button
                    key={revision.id}
                    type="button"
                    onClick={() => setSelectedRevision(revision)}
                    aria-pressed={selectedRevision?.id === revision.id}
                    className={`w-full px-3 py-2 text-xs flex items-center justify-between text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selectedRevision?.id === revision.id ? "bg-accent" : ""
                    }`}
                  >
                      <span className="flex items-center gap-1.5">
                      Version {revision.version}
                        {selectedRevision?.id === revision.id && (
                          <Eye className="h-3.5 w-3.5 text-primary" aria-label="Currently viewing" />
                        )}
                    </span>
                    <span className="text-muted-foreground">
                      {revision.generated_at ? new Date(revision.generated_at).toLocaleString() : "Not generated"}
                    </span>
                  </button>
                ))}
              </div>
              {selectedRevision && (
                <p className="text-xs text-muted-foreground">
                  Viewing a read-only historical version. Assessor overrides are disabled until you return to the current report.
                </p>
              )}
            </div>
          )}

          <Separator />

          {/* Fit/Gap */}
          <div className="border rounded-lg p-4 space-y-3">
            <div>
              <h2 className="text-sm font-semibold">Fit/Gap analysis</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Compare this portfolio with a vacancy.
              </p>
            </div>
            <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
              <SelectTrigger className="w-full">
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
            <Button className="w-full" onClick={handleRunFitGap} disabled={!selectedVacancy}>
              Run Fit/Gap Analysis →
            </Button>
          </div>
          </aside>
        </div>
      )}
    </div>
  );
}
