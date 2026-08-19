import { useEffect, useState, useCallback, useRef } from "react";
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
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, FileText, TriangleAlert } from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";

// After this long stuck in the generating/pending state, the page stops pretending
// generation is healthy and offers a working Retry (the backend now allows
// regenerate from pending/generating/failed).
const GENERATION_TIMEOUT_MS = 3 * 60 * 1000;

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [generatingSince, setGeneratingSince] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  const fetchPortfolio = useCallback(async () => {
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    const data = res.data as any;
    if (data.status === "generating" || data.portfolio?.generation_status === "generating" || data.portfolio?.generation_status === "pending") {
      setGenerating(true);
      setFetchError(null);
      setGeneratingSince((prev) => prev ?? Date.now());
    } else if (data.portfolio) {
      setPortfolio(data.portfolio);
      setGenerating(false);
      setGeneratingSince(null);
      // Build overrides map
      const overrideMap: Record<number, AssessorOverride> = {};
      data.portfolio.overrides.forEach((o: AssessorOverride) => {
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
      .catch(() => setFetchError("Could not load this portfolio. Check your connection and try again."))
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  // Poll while generating
  usePolling(fetchPortfolio, 5000, generating);

  // While stuck generating, re-render every 30s so the "taking longer than
  // expected" banner can appear exactly when the timeout budget elapses.
  useEffect(() => {
    if (!generating || generatingSince == null) return;
    const id = setInterval(() => forceTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [generating, generatingSince]);

  const handleRetry = async () => {
    setFetchError(null);
    try {
      await sessionsApi.regeneratePortfolio(Number(sessionId));
      setGenerating(true);
      setGeneratingSince(Date.now());
      await fetchPortfolio();
    } catch {
      setFetchError("Could not queue a retry. Please try again.");
    }
  };

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

  const generationTimedOut = generating && generatingSince != null && Date.now() - generatingSince > GENERATION_TIMEOUT_MS;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Link to={`/assessments/${id}/invite`} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Portfolio Results</h1>
            {candidateName && (
              <p className="text-sm text-muted-foreground">{candidateName}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex items-center gap-1 text-sm border rounded-md px-3 py-1.5 hover:bg-accent transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Transcript
          </Link>
          {!generating && portfolio && portfolio.generation_status === "complete" && (
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

      {/* Fetch error state (distinct, actionable) */}
      {!generating && fetchError && (
        <div className="border border-destructive/40 rounded-lg p-6 text-center space-y-3">
          <TriangleAlert className="h-6 w-6 text-destructive mx-auto" />
          <p className="text-sm text-destructive">{fetchError}</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchPortfolio().catch(() => {}).finally(() => setLoading(false)); }}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry load
            </Button>
          </div>
        </div>
      )}

      {/* Generating state (healthy, within timeout budget) */}
      {generating && !generationTimedOut && (
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

      {/* Generating state (stuck past the timeout budget) */}
      {generating && generationTimedOut && (
        <div className="border border-amber-500/40 bg-amber-500/5 rounded-lg p-6 text-center space-y-3">
          <TriangleAlert className="h-6 w-6 text-amber-500 mx-auto" />
          <div>
            <p className="font-medium">This is taking longer than expected.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Generation normally finishes in about 2 minutes. You can wait a little longer or retry now.
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRetry}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry generation
            </Button>
          </div>
        </div>
      )}

      {/* Failed state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <div className="border border-destructive/40 rounded-lg p-6 text-center space-y-3">
          <TriangleAlert className="h-6 w-6 text-destructive mx-auto" />
          <p className="text-sm text-destructive">Portfolio generation failed.</p>
          {portfolio.generation_error && (
            <p className="text-xs text-muted-foreground break-words">
              {portfolio.generation_error}
            </p>
          )}
          <Button variant="outline" size="sm" onClick={handleRetry}>
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

      {/* Empty/loading-but-not-generating fallback */}
      {!generating && !fetchError && !portfolio && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <TriangleAlert className="h-6 w-6 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            No portfolio has been generated for this session yet.
          </p>
        </div>
      )}
    </div>
  );
}
