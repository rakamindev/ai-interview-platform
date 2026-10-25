import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { portfoliosApi } from "@/services/portfolios";
import {
  useGetPortfolio,
  useGetSession,
  useMarkPortfolioReviewed,
  useRegeneratePortfolio,
} from "@/useCases/sessions";
import { useGetVacancies } from "@/useCases/vacancies";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, FileText } from "lucide-react";
import type { Portfolio, AssessorOverride } from "@/types";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);

  const {
    data: portfolioData,
    isLoading: portfolioLoading,
    refetch: refetchPortfolio,
  } = useGetPortfolio(Number(sessionId));
  const { data: sessionData } = useGetSession(Number(sessionId));
  const { data: vacanciesData } = useGetVacancies();
  const markReviewed = useMarkPortfolioReviewed();
  const regeneratePortfolio = useRegeneratePortfolio();

  // Derive state from query data
  const portfolioResult = portfolioData as any;
  const generating =
    portfolioResult?.status === "generating" ||
    portfolioResult?.portfolio?.generation_status === "generating" ||
    portfolioResult?.portfolio?.generation_status === "pending";
  const portfolio: Portfolio | null = portfolioResult?.portfolio ?? null;
  const reviewed = !!portfolio?.reviewed_at;
  const vacancies = vacanciesData?.vacancies ?? [];
  const candidateName = sessionData?.session?.candidate_name ?? null;
  const loading = portfolioLoading;

  // Poll while generating
  usePolling(() => {
    refetchPortfolio();
  }, 5000, generating);

  const overrides = portfolio
    ? portfolio.overrides.reduce<Record<number, AssessorOverride>>((map, o) => {
        map[o.portfolio_skill_id] = o;
        return map;
      }, {})
    : {};

  const handleOverrideSaved = (_skillId: number, _override: AssessorOverride) => {
    refetchPortfolio();
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Link
            to={`/assessments/${id}/invite`}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">Portfolio Results</h1>
            {candidateName && (
              <p className="text-sm text-muted-foreground truncate">{candidateName}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                disabled={!!exporting || !reviewed}
              >
                {exporting === "pdf" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1" />
                )}
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
                disabled={!!exporting || !reviewed}
              >
                {exporting === "json" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1" />
                )}
                JSON
              </Button>
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
            onClick={() => regeneratePortfolio.mutate(Number(sessionId))}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      )}

      {/* Ready state */}
      {!generating && portfolio?.generation_status === "complete" && (
        <>
          {portfolio.skills.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No skills were detected — the transcript may have been too short.
            </p>
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
            </>
          )}

          <Separator />

          {/* Mark reviewed gate */}
          {!reviewed && portfolio?.generation_status === "complete" && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => markReviewed.mutate(Number(sessionId))}
                disabled={markReviewed.isPending}
              >
                Mark Reviewed
              </Button>
              <span className="text-xs text-muted-foreground sm:self-center">
                Confirm you have reviewed each skill card before running Fit/Gap.
              </span>
            </div>
          )}

          {/* Fit/Gap */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
              <SelectTrigger className="w-full sm:w-56">
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
            <Button onClick={handleRunFitGap} disabled={!selectedVacancy || !reviewed}>
              Run Fit/Gap Analysis →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
