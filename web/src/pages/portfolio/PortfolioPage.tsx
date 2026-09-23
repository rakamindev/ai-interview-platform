import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import PageHeader from "@/components/layout/PageHeader";
import StatePanel from "@/components/layout/StatePanel";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, FileText } from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";

function isRateLimitedError(error?: string | null) {
  return error === "rate_limited" || error === "rate_limited_all_models";
}

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

  const fetchPortfolio = useCallback(async () => {
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    const data = res.data as any;
    if (data.status === "generating" || data.portfolio?.generation_status === "generating" || data.portfolio?.generation_status === "pending") {
      setGenerating(true);
    } else if (data.portfolio) {
      setPortfolio(data.portfolio);
      setGenerating(false);
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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  usePolling(fetchPortfolio, 5000, generating);

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
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-32" />
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        back={
          <Link to={`/assessments/${id}/invite`} className="text-muted-foreground hover:text-foreground mt-1.5">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        }
        title="Portfolio Results"
        subtitle={candidateName ?? undefined}
        actions={
          <>
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/transcript`}
              className="inline-flex items-center gap-1.5 text-sm border border-foreground/15 px-3 py-1.5 hover:bg-accent transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              Transcript
            </Link>
            {!generating && portfolio?.generation_status === "complete" && (
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
          </>
        }
      />

      {generating && (
        <StatePanel
          variant="generating"
          title="Generating portfolio"
          description="Analyzing the saved interview transcript. If the primary model is busy, a secondary model is tried once automatically."
        >
          <div className="space-y-3 pt-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-3/4" />
          </div>
        </StatePanel>
      )}

      {!generating && portfolio?.generation_status === "failed" && (
        <StatePanel
          variant="error"
          title="Portfolio result is not ready"
          description={
            <>
              The interview itself is saved. Building the skill portfolio failed
              because the model service refused the request
              {isRateLimitedError(portfolio.generation_error)
                ? " (rate limited on both the primary and fallback models)"
                : ""}
              . The candidate is not scored until generation succeeds.
            </>
          }
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await sessionsApi.regeneratePortfolio(Number(sessionId));
                  setGenerating(true);
                }}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry generation
              </Button>
              <Link
                to={`/assessments/${id}/sessions/${sessionId}/transcript`}
                className="text-sm text-primary hover:underline self-center"
              >
                Open saved transcript
              </Link>
            </>
          }
        >
          {portfolio.generation_error && (
            <p className="text-xs text-muted-foreground font-mono">
              Reason: {portfolio.generation_error}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Retry is a manual second attempt. It may hit the same limit.
          </p>
        </StatePanel>
      )}

      {!generating && portfolio?.generation_status === "complete" && (
        <>
          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">Configured skills</h2>
            {portfolio.skills
              .filter((s) => !s.is_discovered)
              .map((skill, i) => (
                <div key={skill.id} className="animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                  <SkillPortfolioCard
                    skill={skill}
                    override={overrides[skill.id]}
                    onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                  />
                </div>
              ))}
          </div>

          {portfolio.skills.some((s) => s.is_discovered) && (
            <div className="space-y-3 border-t border-foreground/10 pt-6">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-secondary-foreground" />
                  Discovered skills
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
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
          )}

          <div className="border-t border-foreground/10 pt-6 flex flex-col sm:flex-row gap-3 sm:items-center">
            <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
              <SelectTrigger className="w-full sm:w-56 bg-card">
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
            <Button onClick={handleRunFitGap} disabled={!selectedVacancy} className="w-full sm:w-auto">
              Run Fit/Gap Analysis →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
