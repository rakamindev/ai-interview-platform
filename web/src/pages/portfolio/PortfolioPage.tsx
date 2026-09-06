import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import NotAssessedSkillCard from "@/components/portfolio/NotAssessedSkillCard";
import HiringDecisionPanel from "@/components/portfolio/HiringDecisionPanel";
import ErrorState from "@/components/ui/ErrorState";
import { motion, type Variants } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { getHiringDecision, type HiringDecision } from "@/services/hiringDecisions";
import { parseApiError, type ApiError } from "@/utils/apiError";
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
  const [pageError, setPageError] = useState<ApiError | null>(null);
  const [hiringDecision, setHiringDecision] = useState<HiringDecision | null>(null);

  const reducedMotion = useReducedMotion();

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: reducedMotion ? 0 : 0.05,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] as const },
    },
  };

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
      const decision = await getHiringDecision(data.portfolio.id).catch(() => null);
      setHiringDecision(decision);
    }
  }, [sessionId]);

  const loadPortfolioData = useCallback(() => {
    setLoading(true);
    setPageError(null);
    Promise.all([fetchPortfolio(), vacanciesApi.list(), sessionsApi.get(Number(sessionId))])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data.vacancies);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch((err) => setPageError(parseApiError(err)))
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  useEffect(() => {
    loadPortfolioData();
  }, [loadPortfolioData]);

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

  if (pageError) return <ErrorState error={pageError} onRetry={loadPortfolioData} />;

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
          {(() => {
            const configuredSkills = portfolio.skills?.filter((s) => !s.is_discovered) ?? [];
            const discoveredSkills = portfolio.skills?.filter((s) => s.is_discovered) ?? [];
            const notAssessedSkills = configuredSkills.filter((s) => s.not_assessed);
            const ratedSkills = configuredSkills.filter((s) => !s.not_assessed);

            return (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-6"
              >
                {/* Configured skills */}
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold">Configured Skills</h2>
                  <div className="space-y-3">
                    {ratedSkills.map((skill) => (
                      <SkillPortfolioCard
                        key={skill.id}
                        skill={skill}
                        override={overrides[skill.id]}
                        onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                        customVariants={itemVariants}
                      />
                    ))}
                  </div>

                  {/* Not assessed skills */}
                  {notAssessedSkills.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <p className="text-xs text-muted-foreground/70">
                        {notAssessedSkills.length} skill tidak mendapat cukup probe untuk dinilai:
                      </p>
                      <div className="space-y-2">
                        {notAssessedSkills.map((skill) => (
                          <NotAssessedSkillCard
                            key={skill.id}
                            skillLabel={skill.skill_label}
                            customVariants={itemVariants}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Discovered skills */}
                {discoveredSkills.length > 0 && (
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
                      <div className="space-y-3">
                        {discoveredSkills.map((skill) => (
                          <SkillPortfolioCard
                            key={skill.id}
                            skill={skill}
                            override={overrides[skill.id]}
                            onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                            customVariants={itemVariants}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            );
          })()}

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

          <Separator />

          {/* Hiring Decision Panel */}
          <div className="mt-6">
            <HiringDecisionPanel
              portfolioId={portfolio.id}
              existing={hiringDecision}
              onDecisionMade={(d) => setHiringDecision(d)}
            />
          </div>
        </>
      )}
    </div>
  );
}
