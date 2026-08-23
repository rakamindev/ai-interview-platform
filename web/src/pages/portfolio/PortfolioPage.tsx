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
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, FileText, AlertCircle } from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await sessionsApi.getPortfolio(Number(sessionId));
      const data = res.data as any;
      if (data.status === "generating" || data.portfolio?.generation_status === "generating" || data.portfolio?.generation_status === "pending") {
        setGenerating(true);
        if (data.portfolio) setPortfolio(data.portfolio);
      } else if (data.portfolio) {
        setPortfolio(data.portfolio);
        setGenerating(false);
        setGenerationSeconds(0);
        // Build overrides map
        const overrideMap: Record<number, AssessorOverride> = {};
        (data.portfolio.overrides || []).forEach((o: AssessorOverride) => {
          overrideMap[o.portfolio_skill_id] = o;
        });
        setOverrides(overrideMap);
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setLoadError("Portfolio session not found or has been deleted.");
      } else {
        setLoadError("Unable to load portfolio details. Please check your connection.");
      }
    }
  }, [sessionId]);

  useEffect(() => {
    Promise.all([fetchPortfolio(), vacanciesApi.list(), sessionsApi.get(Number(sessionId))])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data?.vacancies ?? []);
        setCandidateName(sRes.data?.session?.candidate_name ?? null);
      })
      .catch((err) => {
        if (!loadError) setLoadError("Failed to initialize portfolio view.");
      })
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  // Track generation time budget
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (generating) {
      timer = setInterval(() => {
        setGenerationSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setGenerationSeconds(0);
    }
    return () => clearInterval(timer);
  }, [generating]);

  // Poll while generating
  usePolling(fetchPortfolio, 4000, generating);

  const handleOverrideSaved = (skillId: number, override: AssessorOverride) => {
    setOverrides((prev) => ({ ...prev, [skillId]: override }));
  };

  const handleRunFitGap = () => {
    if (!selectedVacancy || !portfolio) return;
    navigate(`/assessments/${id}/sessions/${sessionId}/fitgap/${selectedVacancy}`);
  };

  const handleRegenerate = async () => {
    try {
      setGenerating(true);
      setGenerationSeconds(0);
      await sessionsApi.regeneratePortfolio(Number(sessionId));
      await fetchPortfolio();
    } catch {
      setGenerating(false);
    }
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
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <Link to={`/assessments/${id}/invite`} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-semibold">Portfolio Results</h1>
        </div>
        <div className="border border-border rounded-lg p-8 text-center space-y-4 bg-muted/20">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
          <div>
            <p className="font-medium text-foreground">{loadError}</p>
            <p className="text-sm text-muted-foreground mt-1">
              The requested assessment session could not be retrieved.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(`/assessments/${id}/invite`)}>
            Back to Assessment
          </Button>
        </div>
      </div>
    );
  }

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
          {!generating && portfolio?.generation_status === "complete" && (
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
      {generating && (
        <div className="border rounded-lg p-10 text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <div>
            <p className="font-medium">Generating skill portfolio...</p>
            <p className="text-sm text-muted-foreground mt-1">
              The AI is analyzing the full interview transcript and extracting behavioral quotes. ({generationSeconds}s elapsed)
            </p>
          </div>
          {generationSeconds >= 120 && (
            <div className="pt-2 border-t text-xs text-muted-foreground space-y-2">
              <p>Generation is taking longer than usual. You can wait or retry synthesis.</p>
              <Button variant="outline" size="sm" onClick={handleRegenerate}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry Synthesis
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Failed state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <div className="border border-destructive/40 bg-destructive/5 rounded-lg p-6 text-center space-y-3">
          <div>
            <p className="text-sm font-semibold text-destructive">Portfolio generation failed</p>
            <p className="text-xs text-muted-foreground mt-1">
              {portfolio.generation_error || "The AI model encountered a temporary timeout. Please retry generation."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry Generation
          </Button>
        </div>
      )}

      {/* Ready state */}
      {!generating && portfolio?.generation_status === "complete" && (
        <>
          {portfolio.skills.length === 0 ? (
            <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">No competency skills recorded</p>
              <p>The interview completed without probing the required skill rubrics.</p>
            </div>
          ) : (
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
                        Skills the AI probed that were not in the original assessment rubric
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
