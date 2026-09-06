import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import PortfolioHeader from "@/components/portfolio/PortfolioHeader";
import UnassessedSkillsSection from "@/components/portfolio/UnassessedSkillsSection";
import DiscoveredSkillsSection from "@/components/portfolio/DiscoveredSkillsSection";
import FitGapSelectorCard from "@/components/portfolio/FitGapSelectorCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
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
        setErrorMessage(null);
        const overrideMap: Record<number, AssessorOverride> = {};
        (data.portfolio.overrides || []).forEach((o: AssessorOverride) => {
          overrideMap[o.portfolio_skill_id] = o;
        });
        setOverrides(overrideMap);
      }
    } catch {
      // background polling silent catch
    }
  }, [sessionId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [pRes, vRes, sRes] = await Promise.all([
        sessionsApi.getPortfolio(Number(sessionId)),
        vacanciesApi.list(),
        sessionsApi.get(Number(sessionId)),
      ]);
      const data = pRes.data as any;
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
        (data.portfolio.overrides || []).forEach((o: AssessorOverride) => {
          overrideMap[o.portfolio_skill_id] = o;
        });
        setOverrides(overrideMap);
      }
      setVacancies(vRes.data.vacancies || []);
      setCandidateName(sRes.data.session?.candidate_name ?? null);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        setErrorMessage("Interview session or portfolio not found (404).");
      } else if (status === 403) {
        setErrorMessage("Access denied. You do not have permission to view this portfolio (403).");
      } else if (status === 422) {
        setErrorMessage("Invalid request parameters for this portfolio (422).");
      } else {
        setErrorMessage("Failed to load interview context. Please check your connection.");
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      const ext = format;
      const blob =
        format === "pdf"
          ? new Blob([res.data as BlobPart], { type: "application/pdf" })
          : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeSlug = candidateName
        ? candidateName.toLowerCase().replace(/[^a-z0-9_-]/gi, "-").replace(/-+/g, "-")
        : sessionId;
      a.download = `portfolio-${safeSlug}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const isSkillUnassessed = (s: any) =>
    s.ai_level === 0 ||
    ((!s.evidence || s.evidence.length === 0) &&
      (s.ai_confidence === "low" || (s.competency_summary || "").toLowerCase().includes("not probed")));

  const configuredSkills = portfolio?.skills.filter((s) => !s.is_discovered) || [];
  const discoveredSkills = portfolio?.skills.filter((s) => s.is_discovered) || [];
  const unassessedSkills = configuredSkills.filter(isSkillUnassessed);
  const assessedSkills = configuredSkills.filter((s) => !isSkillUnassessed(s));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <PortfolioHeader
        assessmentId={id || ""}
        sessionId={sessionId || ""}
        candidateName={candidateName}
        generating={generating}
        hasPortfolio={!!portfolio}
        exporting={exporting}
        onExport={handleExport}
      />

      {/* Error state (BUG-05 fix: never blank screen) */}
      {errorMessage && (
        <div className="border border-destructive/40 rounded-lg p-4 flex items-center justify-between text-sm text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} className="h-7 text-xs">
            <RefreshCw className="h-3 w-3 mr-1" /> Retry
          </Button>
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <div>
            <p className="font-medium">Generating competency portfolio...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Analyzing interview dialogue and behavioral anchors.
            </p>
          </div>
        </div>
      )}

      {/* Ready state */}
      {!generating && portfolio && (
        <>
          {/* Assessed Configured skills */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Configured Assessment Skills</h2>
            <div className="space-y-3">
              {assessedSkills.map((skill) => (
                <SkillPortfolioCard
                  key={skill.id}
                  skill={skill}
                  override={overrides[skill.id]}
                  onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                />
              ))}
            </div>
          </div>

          {/* Unassessed skills (GAP-02 fix) */}
          <UnassessedSkillsSection
            skills={unassessedSkills}
            overrides={overrides}
            onOverrideSaved={handleOverrideSaved}
          />

          {/* Discovered skills */}
          <DiscoveredSkillsSection
            skills={discoveredSkills}
            overrides={overrides}
            onOverrideSaved={handleOverrideSaved}
          />

          <Separator />

          {/* Role Fit & Gap Analysis Selector */}
          <FitGapSelectorCard
            vacancies={vacancies}
            selectedVacancy={selectedVacancy}
            onSelectVacancy={setSelectedVacancy}
            onRunFitGap={handleRunFitGap}
          />
        </>
      )}
    </div>
  );
}
