import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import AssessmentSummary from "@/components/portfolio/AssessmentSummary";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { sortAssessedFirst } from "@/utils/skills";
import { AlertCircle, ArrowLeft, Download, Loader2, RefreshCw, Zap, FileText } from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy, EndReason } from "@/types";

type PageStatus = "loading" | "load_error" | "generating" | "failed" | "ready";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<PageStatus>("loading");
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<EndReason | null>(null);

  const fetchPortfolio = useCallback(async () => {
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    const data = res.data as { status?: string; portfolio?: Portfolio };
    const generationStatus = data.portfolio?.generation_status;

    if (data.status === "generating" || generationStatus === "generating" || generationStatus === "pending") {
      setStatus("generating");
      return;
    }
    if (!data.portfolio) return;

    setPortfolio(data.portfolio);
    setOverrides(Object.fromEntries(data.portfolio.overrides.map((o) => [o.portfolio_skill_id, o])));
    setStatus(generationStatus === "failed" ? "failed" : "ready");
  }, [sessionId]);

  const load = useCallback(() => {
    setStatus("loading");
    Promise.all([fetchPortfolio(), vacanciesApi.list(), sessionsApi.get(Number(sessionId))])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data.vacancies);
        setCandidateName(sRes.data.session.candidate_name ?? null);
        setEndReason(sRes.data.session.end_reason ?? null);
      })
      .catch(() => setStatus("load_error"));
  }, [fetchPortfolio, sessionId]);

  useEffect(load, [load]);

  usePolling(() => fetchPortfolio().catch(() => undefined), 5000, status === "generating");

  const handleOverrideSaved = (skillId: number, override: AssessorOverride) => {
    setOverrides((prev) => ({ ...prev, [skillId]: override }));
  };

  const handleRetryGeneration = async () => {
    setRetrying(true);
    try {
      await sessionsApi.regeneratePortfolio(Number(sessionId));
      setStatus("generating");
    } finally {
      setRetrying(false);
    }
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
      const blob =
        format === "pdf"
          ? new Blob([res.data as BlobPart], { type: "application/pdf" })
          : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portfolio-${sessionId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(`Couldn't export the ${format.toUpperCase()}. Try again in a moment.`);
    } finally {
      setExporting(null);
    }
  };

  if (status === "loading") {
    return (
      <div className="max-w-2xl mx-auto space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const configuredSkills = sortAssessedFirst(portfolio?.skills.filter((s) => !s.is_discovered) ?? []);
  const discoveredSkills = portfolio?.skills.filter((s) => s.is_discovered) ?? [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to={`/assessments/${id}/invite`}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Back to sessions"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">Portfolio results</h1>
            {candidateName && <p className="text-sm text-muted-foreground truncate">{candidateName}</p>}
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
          {status === "ready" && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting}>
                {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!!exporting}>
                {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {exportError && (
        <p className="text-sm text-destructive" role="alert">
          {exportError}
        </p>
      )}

      {status === "load_error" && (
        <div className="border border-destructive/40 rounded-lg p-6 text-center space-y-3">
          <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
          <p className="text-sm">Couldn't load this portfolio. Try again, or go back to the session list.</p>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try again
          </Button>
        </div>
      )}

      {status === "generating" && (
        <div className="border rounded-lg p-12 text-center space-y-3" role="status">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <div>
            <p className="font-medium">Generating portfolio</p>
            <p className="text-sm text-muted-foreground mt-1">
              The AI is reviewing the interview transcript. This usually takes about 2 minutes, and this page updates
              on its own.
            </p>
          </div>
        </div>
      )}

      {status === "failed" && (
        <div className="border border-destructive/40 rounded-lg p-6 text-center space-y-3">
          <p className="text-sm font-medium text-destructive">Portfolio generation failed</p>
          {portfolio?.generation_error && (
            <p className="text-sm text-muted-foreground">{portfolio.generation_error}</p>
          )}
          <Button variant="outline" size="sm" onClick={handleRetryGeneration} disabled={retrying}>
            {retrying ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Generate again
          </Button>
        </div>
      )}

      {status === "ready" && portfolio && (
        <>
          <AssessmentSummary skills={portfolio.skills} endReason={endReason} />

          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Configured skills</h2>
            {configuredSkills.length === 0 && (
              <p className="text-sm text-muted-foreground">This assessment had no configured skills.</p>
            )}
            {configuredSkills.map((skill) => (
              <SkillPortfolioCard
                key={skill.id}
                skill={skill}
                override={overrides[skill.id]}
                onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
              />
            ))}
          </div>

          {discoveredSkills.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Discovered skills
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Skills the candidate brought up that were not in the original assessment
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
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Compare with a vacancy</h2>
            {vacancies.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No vacancies yet. <Link to="/vacancies/new" className="text-primary hover:underline">Create a vacancy</Link>{" "}
                to compare this candidate against its requirements.
              </p>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                  <SelectTrigger className="w-full sm:w-64">
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
                <Button onClick={handleRunFitGap} disabled={!selectedVacancy}>
                  Run fit/gap analysis
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
