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
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, FileText, AlertTriangle, AlertCircle, Info } from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy, Session } from "@/types";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await sessionsApi.getPortfolio(Number(sessionId));
      const data = res.data;
      if (data.status === "unavailable" || (!data.portfolio && data.status !== "generating")) {
        setPortfolio(null);
        setGenerating(false);
      } else if (data.status === "generating" || data.portfolio?.generation_status === "generating" || data.portfolio?.generation_status === "pending") {
        setGenerating(true);
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        }
      } else if (data.portfolio) {
        setPortfolio(data.portfolio);
        setGenerating(false);
        const overrideMap: Record<number, AssessorOverride> = {};
        data.portfolio.overrides?.forEach((o: AssessorOverride) => {
          overrideMap[o.portfolio_skill_id] = o;
        });
        setOverrides(overrideMap);
      }
      setLoadError(null);
    } catch {
      setLoadError("Failed to load portfolio evaluation. Please try again.");
    }
  }, [sessionId]);

  const loadInitialData = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      fetchPortfolio(),
      vacanciesApi.list().catch(() => ({ data: { vacancies: [] as Vacancy[] } })),
      sessionsApi.get(Number(sessionId)).catch(() => ({
        data: { session: null, assessment: null } as {
          session: Session | null;
          assessment: { id: number; name: string; time_limit_min: number } | null;
        },
      }))
    ])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data?.vacancies || []);
        const session = sRes.data?.session;
        setCandidateName(session?.candidate_name ?? null);
      })
      .catch(() => {
        setLoadError("Failed to load session details.");
      })
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Poll while generating
  usePolling(fetchPortfolio, 4000, generating);

  const handleOverrideSaved = (skillId: number, override: AssessorOverride) => {
    setOverrides((prev) => ({ ...prev, [skillId]: override }));
  };

  const handleRunFitGap = () => {
    if (!selectedVacancy || !portfolio) return;
    navigate(`/assessments/${id}/sessions/${sessionId}/fitgap/${selectedVacancy}`);
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio || portfolio.generation_status !== "complete") return;
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

  const handleRegenerate = async () => {
    try {
      setGenerating(true);
      await sessionsApi.regeneratePortfolio(Number(sessionId));
      await fetchPortfolio();
    } catch {
      setGenerating(false);
      setLoadError("Failed to queue portfolio regeneration.");
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 min-w-0" role="status" aria-live="polite">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (loadError && !portfolio) {
    return (
      <div className="max-w-2xl mx-auto border border-destructive/30 rounded-lg p-8 text-center space-y-3 bg-destructive/5 min-w-0">
        <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
        <p className="font-semibold text-destructive">{loadError}</p>
        <Button variant="outline" size="sm" onClick={loadInitialData}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry Loading
        </Button>
      </div>
    );
  }

  const hasSkills = Boolean(portfolio && portfolio.skills && portfolio.skills.length > 0);
  const isInitialGenerating = generating && !hasSkills;
  const isRegeneratingWithPreserved = generating && hasSkills;
  const isInitialFailed = !generating && portfolio?.generation_status === "failed" && !hasSkills;
  const isRegenFailedWithPreserved = !generating && hasSkills && Boolean(portfolio?.generation_error);

  return (
    <div className="max-w-2xl mx-auto space-y-6 min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to={`/assessments/${id}/invite`}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Back to assessment invite"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">Portfolio Results</h1>
            {candidateName && (
              <p className="text-sm text-muted-foreground break-words [overflow-wrap:anywhere]">{candidateName}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex items-center gap-1 text-sm border rounded-md px-3 py-1.5 hover:bg-accent transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Transcript
          </Link>
          {portfolio && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("pdf")}
                disabled={generating || portfolio.generation_status !== "complete" || !!exporting}
              >
                {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
                disabled={generating || portfolio.generation_status !== "complete" || !!exporting}
              >
                {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Initial Generating state */}
      {isInitialGenerating && (
        <div className="border rounded-lg p-12 text-center space-y-3" role="status" aria-live="polite">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <div>
            <p className="font-medium">Generating portfolio...</p>
            <p className="text-sm text-muted-foreground mt-1">
              The AI is analyzing the interview transcript. This takes about 1-2 minutes.
            </p>
          </div>
        </div>
      )}

      {/* Refreshing with preserved results banner */}
      {isRegeneratingWithPreserved && (
        <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-4 flex items-center justify-between gap-3 text-blue-900 flex-wrap" role="status" aria-live="polite">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
            <span>Regenerating evaluation with AI. Previous valid results are displayed below.</span>
          </div>
        </div>
      )}

      {/* Regeneration failure warning with preserved results banner */}
      {isRegenFailedWithPreserved && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 flex items-center justify-between gap-3 text-amber-900 flex-wrap" role="alert">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Regeneration attempt encountered an issue. Preserved and displaying previous valid evaluation.</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleRegenerate} className="bg-white hover:bg-amber-100/50 border-amber-300">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      )}

      {/* Initial Failure state */}
      {isInitialFailed && (
        <div className="border border-destructive/40 bg-destructive/5 rounded-lg p-8 text-center space-y-3" role="alert">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
          <p className="font-semibold text-destructive">
            {portfolio?.generation_error || "Evaluation generation failed. Please retry."}
          </p>
          <Button variant="outline" size="sm" onClick={handleRegenerate}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry Generation
          </Button>
        </div>
      )}

      {/* Empty / Unavailable state */}
      {!generating && !portfolio && !loadError && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <Info className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="font-medium">No evaluation available</p>
          <p className="text-sm text-muted-foreground">
            No portfolio results have been generated for this session yet.
          </p>
        </div>
      )}

      {/* Results view (when skills exist) */}
      {hasSkills && (
        <>
          {/* Configured skills */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Configured Skills</h2>
            {portfolio!.skills
              .filter((s) => !s.is_discovered)
              .map((skill) => (
                <SkillPortfolioCard
                  key={skill.id}
                  skill={skill}
                  override={overrides[skill.id]}
                  disabled={generating}
                  onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                />
              ))}
          </div>

          {/* Discovered skills */}
          {portfolio!.skills.some((s) => s.is_discovered) && (
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
                {portfolio!.skills
                  .filter((s) => s.is_discovered)
                  .map((skill) => (
                    <SkillPortfolioCard
                      key={skill.id}
                      skill={skill}
                      override={overrides[skill.id]}
                      disabled={generating}
                      onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                    />
                  ))}
              </div>
            </>
          )}

          <Separator />

          {/* Fit/Gap */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
              <SelectTrigger className="w-56" disabled={generating} aria-label="Choose vacancy for Fit/Gap analysis">
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
            <Button
              onClick={handleRunFitGap}
              disabled={!selectedVacancy || generating || portfolio!.generation_status !== "complete"}
            >
              Run Fit/Gap Analysis →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
