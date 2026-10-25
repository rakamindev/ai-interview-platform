import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "../components/SkillPortfolioCard";
import {
  usePortfolioQuery,
  useSaveOverrideMutation,
  useRegeneratePortfolioMutation,
} from "../hooks/usePortfolioQuery";
import { useSessionQuery } from "../hooks/useSessionsQuery";
import { useVacanciesQuery } from "@/features/vacancies";
import { portfoliosApi } from "../services/portfolios";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, FileText, Briefcase, AlertCircle } from "lucide-react";
import type { AssessorOverride } from "@/types";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();

  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);

  // TanStack Query: cached portfolio with automatic reactive polling when generating
  const {
    data: portfolioData,
    isLoading: isPortfolioLoading,
    isError: isPortfolioError,
    refetch: refetchPortfolio,
  } = usePortfolioQuery(sessionId);

  // TanStack Query: cached vacancies list
  const { data: vacancies = [] } = useVacanciesQuery();

  // TanStack Query: cached session metadata
  const { data: session } = useSessionQuery(sessionId);

  // TanStack Query: optimistic override mutation
  const saveOverrideMutation = useSaveOverrideMutation(sessionId);

  // TanStack Query: regenerate mutation
  const regenerateMutation = useRegeneratePortfolioMutation(sessionId);

  const portfolio = portfolioData?.portfolio;
  const isGenerating =
    portfolioData?.status === "generating" ||
    portfolio?.generation_status === "generating" ||
    portfolio?.generation_status === "pending";

  const overrides = useMemo(() => {
    const map: Record<number, AssessorOverride> = {};
    if (portfolio?.overrides) {
      portfolio.overrides.forEach((o) => {
        map[o.portfolio_skill_id] = o;
      });
    }
    // Also include overrides attached directly to skills
    if (portfolio?.skills) {
      portfolio.skills.forEach((s) => {
        if (s.assessor_override) {
          map[s.id] = s.assessor_override;
        }
      });
    }
    return map;
  }, [portfolio?.overrides, portfolio?.skills]);

  const handleSaveOverride = async (skillId: number, overrideLevel: number, notes: string) => {
    await saveOverrideMutation.mutateAsync({ skillId, overrideLevel, notes });
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

  if (isPortfolioLoading && !portfolio) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Candidate Skill Portfolio</h1>
            <Skeleton className="h-4 w-40 mt-1" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
      </div>
    );
  }

  const configuredSkills = portfolio?.skills?.filter((s) => !s.is_discovered) || [];
  const discoveredSkills = portfolio?.skills?.filter((s) => s.is_discovered) || [];
  const candidateName = session?.candidate_name ?? null;
  const roleTitle = session?.assessment?.name ?? null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
        <div className="flex items-start gap-3">
          <Link
            to={`/assessments/${id}/invite`}
            className="p-2 rounded-lg border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Back to Sessions"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">Candidate Skill Portfolio</h1>
              <span className="text-xs bg-primary/10 text-primary font-semibold px-2.5 py-0.5 rounded-full">
                Session #{sessionId}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {candidateName ? <span className="font-medium text-foreground">{candidateName}</span> : "Candidate"}
              {roleTitle && <span> • {roleTitle}</span>}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex items-center gap-1.5 text-sm font-medium border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors shadow-xs"
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
            Transcript
          </Link>
          {!isGenerating && portfolio && portfolio.generation_status === "complete" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
                className="shadow-xs"
              >
                {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1.5 text-muted-foreground" />}
                Export PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
                disabled={!!exporting}
                className="shadow-xs"
              >
                {exporting === "json" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1.5 text-muted-foreground" />}
                Export JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Generating State */}
      {isGenerating && (
        <div className="border rounded-xl p-12 text-center space-y-4 bg-muted/20">
          <div className="relative mx-auto w-12 h-12 flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-foreground">Synthesizing Skill Portfolio</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
              Gemini AI is analyzing the full interview transcript, mapping behavioral anchors, and extracting verbatim evidence.
            </p>
          </div>
        </div>
      )}

      {/* Failed State */}
      {!isGenerating && (portfolio?.generation_status === "failed" || isPortfolioError) && (
        <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-6 text-center space-y-3">
          <div className="inline-flex p-3 rounded-full bg-destructive/10 text-destructive mb-1">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-base text-foreground">Portfolio Generation Halted</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
              {portfolio?.generation_error || "An upstream error occurred during analysis. You can trigger a clean retry below."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await regenerateMutation.mutateAsync();
              refetchPortfolio();
            }}
            disabled={regenerateMutation.isPending}
            className="mt-2 border-destructive/30 hover:bg-destructive/10"
          >
            {regenerateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Retry Synthesis
          </Button>
        </div>
      )}

      {/* Ready State */}
      {!isGenerating && portfolio?.generation_status === "complete" && (
        <>
          {/* Configured Assessment Skills */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Target Competencies ({configuredSkills.length})</h2>
                <p className="text-xs text-muted-foreground">Skills explicitly evaluated against role behavioral anchors</p>
              </div>
            </div>

            {configuredSkills.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {configuredSkills.map((skill) => (
                  <SkillPortfolioCard
                    key={skill.id}
                    skill={skill}
                    override={overrides[skill.id]}
                    onSaveOverride={(level, notes) => handleSaveOverride(skill.id, level, notes)}
                  />
                ))}
              </div>
            ) : (
              <div className="p-6 text-center border rounded-xl bg-card text-muted-foreground text-sm">
                No configured assessment skills found.
              </div>
            )}
          </div>

          {/* Discovered Skills */}
          {discoveredSkills.length > 0 && (
            <div className="space-y-3.5 pt-4">
              <Separator />
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Emergent / Discovered Competencies ({discoveredSkills.length})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Additional capabilities the candidate demonstrated that were not in the predefined assessment rubric
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {discoveredSkills.map((skill) => (
                  <SkillPortfolioCard
                    key={skill.id}
                    skill={skill}
                    override={overrides[skill.id]}
                    onSaveOverride={(level, notes) => handleSaveOverride(skill.id, level, notes)}
                  />
                ))}
              </div>
            </div>
          )}

          <Separator className="my-6" />

          {/* Fit/Gap Action Section */}
          <div className="bg-muted/30 border rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                Compare Against Open Job Vacancy
              </h3>
              <p className="text-xs text-muted-foreground">
                Run an automated delta match and generate executive culture & competency narratives.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                <SelectTrigger className="w-full sm:w-60 bg-background">
                  <SelectValue placeholder="Select target vacancy..." />
                </SelectTrigger>
                <SelectContent>
                  {vacancies.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.role_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleRunFitGap} disabled={!selectedVacancy} className="whitespace-nowrap shadow-xs">
                Run Fit/Gap →
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
