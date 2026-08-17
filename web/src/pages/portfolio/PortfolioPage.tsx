import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import SkillLevelChart from "@/components/portfolio/SkillLevelChart";
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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  // Poll while generating
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
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="-mx-4 sm:mx-0 sm:rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b sm:border sm:border-primary/10 px-4 sm:px-6 py-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to={`/assessments/${id}/invite`}
              className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Portfolio Results</h1>
              {candidateName && (
                <p className="text-sm text-muted-foreground mt-0.5">{candidateName}</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/transcript`}
              className="inline-flex items-center gap-1.5 text-sm border bg-background rounded-md px-3 py-1.5 hover:bg-accent hover:shadow-sm transition-all"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Transcript</span>
            </Link>
            {!generating && portfolio && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-background"
                  onClick={() => handleExport("pdf")}
                  disabled={!!exporting}
                >
                  {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-background"
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
      </div>

      <div className="px-4 sm:px-0 space-y-8">
        {/* Generating state */}
        {generating && (
          <div className="border rounded-2xl p-12 text-center space-y-4 bg-gradient-to-b from-primary/5 to-transparent">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <div>
              <p className="font-semibold">Generating portfolio…</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                The AI is analyzing the interview transcript. This takes about 2 minutes.
              </p>
            </div>
          </div>
        )}

        {/* Failed state */}
        {!generating && portfolio?.generation_status === "failed" && (
          <div className="border border-destructive/30 bg-destructive/5 rounded-2xl p-8 text-center space-y-4">
            <p className="text-sm font-medium text-destructive">Portfolio generation failed.</p>
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
            <SkillLevelChart skills={portfolio.skills} overrides={overrides} />

            {/* Configured skills */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Configured Skills
              </h2>
              <div className="space-y-4">
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
            </div>

            {/* Discovered skills */}
            {portfolio.skills.some((s) => s.is_discovered) && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      Discovered Skills
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Skills the AI probed that were not in the original assessment
                    </p>
                  </div>
                  <div className="space-y-4">
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
                </div>
              </>
            )}

            <Separator />

            {/* Fit/Gap */}
            <div className="rounded-2xl border bg-gradient-to-br from-primary/5 to-transparent p-5 space-y-3">
              <div>
                <h2 className="text-sm font-semibold">Run a Fit/Gap Analysis</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Compare this candidate against a vacancy's requirements.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                  <SelectTrigger className="w-56 bg-background">
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}
