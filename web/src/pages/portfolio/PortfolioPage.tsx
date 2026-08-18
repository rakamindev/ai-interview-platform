import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, FileText } from "lucide-react";
import { usePortfolioPage } from "./usePortfolioPage";

export default function PortfolioPage() {
  const {
    id,
    sessionId,
    portfolio,
    generating,
    loading,
    overrides,
    vacancies,
    selectedVacancy,
    exporting,
    candidateName,
    setSelectedVacancy,
    handleOverrideSaved,
    handleRunFitGap,
    handleExport,
    handleRegenerate,
    fetchError,
    refetchData,
    exportError,
  } = usePortfolioPage();

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
      {fetchError ? (
        <div className="flex flex-col items-center justify-center pt-3 pb-6 min-h-[40vh] text-center">
          <p className="mt-1 text-sm text-destructive">
            We couldn't retrieve the page. Please try again.
          </p>
          <Button className="mt-3" variant="destructiveOutline" onClick={refetchData}>
            Try Again
          </Button>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between flex-wrap">
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

            <div className="flex gap-2 grow justify-end pt-3 xs:pt-0">
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
                onClick={handleRegenerate}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          )}

          {/* Ready state */}
          {!generating && portfolio?.generation_status === "complete" && (
            <>
              {/* Export Error */}
              {exportError && (
                <div className="bg-destructive/15 p-3 rounded-md text-sm text-destructive">
                  <p>{exportError}</p>
                </div>
              )}

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
        </>
      )}
    </div>
  );
}
