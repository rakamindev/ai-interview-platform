import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { assessmentsApi } from "@/services/assessments";
import { usePolling } from "@/hooks/usePolling";
import { useToast } from "@/hooks/useToast";
import { useUser } from "@/hooks/useUser";
import { parseLevel } from "@/utils/constants";
import {
  Download,
  Loader2,
  RefreshCw,
  Zap,
  FileText,
  CheckCircle2,
  Award,
  TrendingUp,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy, Assessment } from "@/types";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const { canEdit } = useUser();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await sessionsApi.getPortfolio(Number(sessionId));
      const data = res.data as any;
      if (
        data.status === "generating" ||
        data.portfolio?.generation_status === "generating" ||
        data.portfolio?.generation_status === "pending"
      ) {
        setGenerating(true);
      } else if (data.portfolio) {
        setPortfolio(data.portfolio);
        setGenerating(false);
        const overrideMap: Record<number, AssessorOverride> = {};
        data.portfolio.overrides?.forEach((o: AssessorOverride) => {
          overrideMap[o.portfolio_skill_id] = o;
        });
        setOverrides(overrideMap);
      }
    } catch {
      // transient
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    Promise.all([
      fetchPortfolio(),
      vacanciesApi.list(),
      sessionsApi.get(Number(sessionId)),
      id ? assessmentsApi.get(Number(id)) : Promise.resolve(null as any),
    ])
      .then(([, vRes, sRes, aRes]) => {
        setVacancies(vRes.data.vacancies || []);
        setCandidateName(sRes.data.session?.candidate_name ?? null);
        if (aRes?.data?.assessment) {
          setAssessment(aRes.data.assessment);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId, id]);

  usePolling(fetchPortfolio, 4000, generating);

  const expectedLevels = useMemo(() => {
    const map: Record<string, number> = {};
    assessment?.skills?.forEach((s) => {
      map[s.skill_label.toLowerCase()] = s.expected_level;
      if (s.id) map[String(s.id)] = s.expected_level;
    });
    return map;
  }, [assessment]);

  const scoreMetrics = useMemo(() => {
    if (!portfolio?.skills) return { matchCount: 0, totalConfigured: 0, avgLevel: "0" };
    const configured = portfolio.skills.filter((s) => !s.is_discovered);
    let matchCount = 0;
    let totalLevel = 0;

    configured.forEach((s) => {
      const actualLevel = overrides[s.id]?.override_level ?? parseLevel(s.ai_level);
      const target = expectedLevels[s.skill_label.toLowerCase()] || 3;
      if (actualLevel >= target) matchCount++;
      totalLevel += actualLevel;
    });

    const avgLevel = configured.length > 0 ? (totalLevel / configured.length).toFixed(1) : "0";
    return { matchCount, totalConfigured: configured.length, avgLevel };
  }, [portfolio, overrides, expectedLevels]);

  const handleOverrideSaved = (skillId: number, override: AssessorOverride) => {
    setOverrides((prev) => ({ ...prev, [skillId]: override }));
    success("Override saved", "Audit record created and fit/gap queued for refresh.");
  };

  const handleEvidenceClick = (quote: string) => {
    navigate(
      `/assessments/${id}/sessions/${sessionId}/transcript?highlight=${encodeURIComponent(quote.substring(0, 40))}`
    );
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
      success("Export ready", `Downloaded portfolio-${sessionId}.${format}`);
    } catch {
      toastError("Export failed", "Could not export portfolio document.");
    } finally {
      setExporting(null);
    }
  };

  if (loading) return <LoadingState rows={5} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidate Competency Portfolio"
        description={`${assessment?.name || "Interview Evaluation"} · Candidate: ${candidateName || "Candidate #" + sessionId}`}
        backHref={`/assessments/${id}/invite`}
        backLabel="Assessment Sessions"
        actions={
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/transcript`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold border rounded-lg px-3 py-2 bg-card hover:bg-muted transition-colors shadow-xs"
            >
              <FileText className="h-4 w-4 text-primary" />
              Full Transcript
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
        }
      />

      {/* Generating state */}
      {generating && (
        <Card className="p-12 text-center space-y-4 border-dashed bg-muted/20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="font-bold text-base text-foreground">AI Portfolio Evaluation in Progress</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The AI engine is analyzing speech turns, extracting direct quotes, and grading anchor levels. This takes about 1-2 minutes.
            </p>
          </div>
        </Card>
      )}

      {/* Failed state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <Card className="border-destructive/30 bg-destructive/5 p-8 text-center space-y-3">
          <ShieldAlert className="h-8 w-8 text-destructive mx-auto" />
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="font-bold text-sm text-destructive">Evaluation Generation Failed</h3>
            <p className="text-xs text-muted-foreground">
              {portfolio.generation_error || "An error occurred during transcript evaluation."}
            </p>
          </div>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await sessionsApi.regeneratePortfolio(Number(sessionId));
                setGenerating(true);
              }}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry Portfolio Generation
            </Button>
          )}
        </Card>
      )}

      {/* Ready Complete State */}
      {!generating && portfolio?.generation_status === "complete" && (
        <div className="space-y-6">
          {/* Summary Score Header Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="shadow-xs bg-card border-l-4 border-l-primary">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Competency Fit
                  </span>
                  <div className="text-2xl font-bold tracking-tight text-foreground">
                    {scoreMetrics.matchCount} / {scoreMetrics.totalConfigured}{" "}
                    <span className="text-xs font-normal text-muted-foreground">skills met</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs bg-card border-l-4 border-l-teal-500">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Average Level
                  </span>
                  <div className="text-2xl font-bold tracking-tight text-foreground">
                    L{scoreMetrics.avgLevel}{" "}
                    <span className="text-xs font-normal text-muted-foreground">/ 5.0</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs bg-card border-l-4 border-l-amber-500">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Discovered Skills
                  </span>
                  <div className="text-2xl font-bold tracking-tight text-foreground">
                    {portfolio.skills.filter((s) => s.is_discovered).length}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600">
                  <Zap className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Configured Rubric Skills */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              <span>Assessed Competencies ({portfolio.skills.filter((s) => !s.is_discovered).length})</span>
            </h2>
            <div className="space-y-3">
              {portfolio.skills
                .filter((s) => !s.is_discovered)
                .map((skill) => (
                  <SkillPortfolioCard
                    key={skill.id}
                    skill={skill}
                    override={overrides[skill.id]}
                    expectedLevel={expectedLevels[skill.skill_label.toLowerCase()]}
                    onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                    onEvidenceClick={handleEvidenceClick}
                    canEdit={canEdit}
                  />
                ))}
            </div>
          </div>

          {/* Discovered Skills */}
          {portfolio.skills.some((s) => s.is_discovered) && (
            <div className="space-y-3 pt-2">
              <div>
                <h2 className="text-sm font-bold tracking-tight text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Zap className="h-4 w-4" />
                  <span>Discovered Candidate Competencies</span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Additional strengths revealed dynamically during the conversational interview.
                </p>
              </div>
              <div className="space-y-3">
                {portfolio.skills
                  .filter((s) => s.is_discovered)
                  .map((skill) => (
                    <SkillPortfolioCard
                      key={skill.id}
                      skill={skill}
                      override={overrides[skill.id]}
                      onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                      onEvidenceClick={handleEvidenceClick}
                      canEdit={canEdit}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Run Fit/Gap Bar */}
          <Card className="p-4 bg-muted/20 border shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-foreground">Compare Against Role Vacancy</h4>
                <p className="text-xs text-muted-foreground">
                  Benchmark candidate competencies against hiring requirements and generate a Fit/Gap gap analysis report.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                  <SelectTrigger className="w-full sm:w-56 text-xs">
                    <SelectValue placeholder="Select target vacancy..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vacancies.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)} className="text-xs">
                        {v.role_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleRunFitGap} disabled={!selectedVacancy} size="sm" className="w-full sm:w-auto">
                  <span>Run Fit/Gap</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
