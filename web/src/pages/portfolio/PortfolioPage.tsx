import { useEffect, useState, useCallback } from "react";
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
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";
import { MOCK_AI_ENABLED, mockPortfolio } from "@/mocks/aiFixtures";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [generationTimedOut, setGenerationTimedOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    if (MOCK_AI_ENABLED) {
      setPortfolio(mockPortfolio);
      setGenerating(false);
      setGenerationTimedOut(false);
      const overrideMap: Record<number, AssessorOverride> = {};
      mockPortfolio.overrides.forEach((o) => { overrideMap[o.portfolio_skill_id] = o; });
      setOverrides(overrideMap);
      return;
    }
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    const data = res.data as any;
    if (data.status === "generating" || data.portfolio?.generation_status === "generating" || data.portfolio?.generation_status === "pending") {
      setGenerating(true);
      setGenerationStartedAt((startedAt) => startedAt ?? Date.now());
    } else if (data.portfolio) {
      setPortfolio(data.portfolio);
      setGenerating(false);
      setGenerationStartedAt(null);
      setGenerationTimedOut(false);
      // Build overrides map
      const overrideMap: Record<number, AssessorOverride> = {};
      data.portfolio.overrides.forEach((o: AssessorOverride) => {
        overrideMap[o.portfolio_skill_id] = o;
      });
      setOverrides(overrideMap);
    }
  }, [sessionId]);

  useEffect(() => {
    if (MOCK_AI_ENABLED) {
      setCandidateName("Budi Santoso");
      setVacancies([{ id: 1, role_title: "Senior Frontend Engineer", culture_dimensions: "", competency_expectations: "", skills: [] }]);
      fetchPortfolio().finally(() => setLoading(false));
      return;
    }
    Promise.all([fetchPortfolio(), vacanciesApi.list(), sessionsApi.get(Number(sessionId))])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data.vacancies);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  // Poll while generating and surface a bounded waiting state if the worker is stale.
  usePolling(fetchPortfolio, 5000, generating && !generationTimedOut);

  useEffect(() => {
    if (!generating || !generationStartedAt || generationTimedOut) return;
    const timeout = window.setTimeout(() => {
      setGenerationTimedOut(true);
      setGenerating(false);
    }, 5 * 60 * 1000);
    return () => window.clearTimeout(timeout);
  }, [generating, generationStartedAt, generationTimedOut]);

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
      <div className="w-full space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-7">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <Link to={`/assessments/${id}/invite`} className="mt-1 rounded-md p-1 text-muted-foreground hover:bg-slate-100 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Decision workspace</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Portfolio results</h1>
            {candidateName && <p className="mt-1 text-sm text-slate-500">{candidateName} · Evidence-backed assessment</p>}
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
      {generating && !generationTimedOut && (
        <div className="rounded-lg border bg-white p-12 text-center shadow-sm space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <div>
            <p className="font-medium">Generating portfolio...</p>
            <p className="text-sm text-muted-foreground mt-1">
              The AI is analyzing the interview transcript. This usually takes about 2 minutes.
            </p>
          </div>
        </div>
      )}

      {/* Timed-out state */}
      {generationTimedOut && (
        <div className="border border-amber-300 bg-amber-50/60 rounded-lg p-6 text-center space-y-3">
          <p className="font-medium text-amber-900">Portfolio generation is taking longer than expected.</p>
          <p className="text-sm text-amber-800/80">
            The interview is complete, but the analysis worker has not finished after 5 minutes. No candidate score has been assigned.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              setGenerationTimedOut(false);
              setGenerationStartedAt(Date.now());
              setGenerating(true);
            }}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh status
            </Button>
            <Button size="sm" onClick={async () => {
              await sessionsApi.regeneratePortfolio(Number(sessionId));
              setGenerationTimedOut(false);
              setGenerationStartedAt(Date.now());
              setGenerating(true);
            }}>
              Retry generation
            </Button>
          </div>
        </div>
      )}

      {/* Failed state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <div className="rounded-lg border border-destructive/40 bg-white p-6 text-center shadow-sm space-y-3">
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
