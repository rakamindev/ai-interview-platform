import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import StateView from "@/components/StateView";
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
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [failedExport, setFailedExport] = useState<"pdf" | "json" | null>(null);

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
    setError(null);
    try {
      const [, vRes, sRes] = await Promise.all([
        fetchPortfolio(),
        vacanciesApi.list(),
        sessionsApi.get(Number(sessionId)),
      ]);
      setVacancies(vRes.data.vacancies);
      setCandidateName(sRes.data.session.candidate_name ?? null);
    } catch {
      setError("Failed to load portfolio.");
    } finally {
      setLoading(false);
    }
  }, [fetchPortfolio, sessionId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  // Poll while generating
  usePolling(
    async () => {
      try {
        await fetchPortfolio();
      } catch {
        setError("Failed to load portfolio.");
      }
    },
    5000,
    generating
  );

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
    setExportError(null);
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
      setFailedExport(null);
    } catch {
      setExportError(`Failed to export the ${format.toUpperCase()} portfolio.`);
      setFailedExport(format);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto min-w-0 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <Link to={`/assessments/${id}/invite`} className="shrink-0 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">Portfolio Results</h1>
            {candidateName && (
              <p className="truncate text-sm text-muted-foreground">{candidateName}</p>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
          >
            <FileText className="h-3.5 w-3.5" />
            Transcript
          </Link>
          {!generating && portfolio && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
              >
                {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
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

      {exportError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
          <span>{exportError}</span>
          <Button
            className="min-h-10 sm:min-h-8"
            variant="outline"
            size="sm"
            onClick={() => failedExport && void handleExport(failedExport)}
          >
            Retry
          </Button>
        </div>
      )}

      <StateView
        loading={loading}
        error={error}
        onRetry={() => void loadPage()}
        empty={!generating && !portfolio}
        emptyContent={<p className="text-sm text-muted-foreground">No portfolio available.</p>}
        loadingContent={
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        }
      >
        <>
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
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                  <SelectTrigger className="w-full min-w-0 sm:w-56">
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
                <Button className="w-full sm:w-auto" onClick={handleRunFitGap} disabled={!selectedVacancy}>
                  Run Fit/Gap Analysis →
                </Button>
              </div>
            </>
          )}
        </>
      </StateView>
    </div>
  );
}
