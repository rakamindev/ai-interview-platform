import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import FitGapHeader from "@/components/fitgap/FitGapHeader";
import MatchSummaryCard from "@/components/fitgap/MatchSummaryCard";
import EvaluationNarrative from "@/components/fitgap/EvaluationNarrative";
import DiscoveredSkillsCard from "@/components/fitgap/DiscoveredSkillsCard";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { usePolling } from "@/hooks/usePolling";
import { Loader2, AlertCircle } from "lucide-react";
import type { FitGapReport, Portfolio, Vacancy, Session } from "@/types";

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
      setErrorMessage(null);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) {
        try {
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          setGenerating(true);
        } catch (trigErr: any) {
          setGenerating(false);
          const trigStatus = trigErr?.response?.status;
          if (trigStatus === 422) {
            setErrorMessage("Portfolio is incomplete and cannot generate a fit/gap report (422).");
          } else if (trigStatus === 403) {
            setErrorMessage("Access denied. You do not have permission to generate this report (403).");
          } else {
            setErrorMessage("Failed to initiate fit/gap report generation.");
          }
        }
      } else if (status === 403) {
        setErrorMessage("Access denied. You do not have permission to view this report (403).");
      } else if (status === 422) {
        setErrorMessage("Unprocessable entity: Invalid parameters or incomplete portfolio (422).");
      } else {
        setErrorMessage("Unable to fetch report data at this time. Please check your connection.");
      }
    }
  }, [portfolio, vacancyId]);

  useEffect(() => {
    Promise.all([
      sessionsApi.getPortfolio(Number(sessionId)),
      vacanciesApi.get(Number(vacancyId)),
      sessionsApi.get(Number(sessionId)),
    ])
      .then(([pRes, vRes, sRes]) => {
        const data = pRes.data as any;
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        }
        if (vRes?.data?.vacancy) {
          setVacancy(vRes.data.vacancy);
        }
        if (sRes?.data?.session) {
          setSession(sRes.data.session);
        }
      })
      .catch((err: any) => {
        const status = err?.response?.status;
        if (status === 404) {
          setErrorMessage("Interview session, portfolio, or vacancy not found (404).");
        } else if (status === 403) {
          setErrorMessage("Access denied. You do not have permission to view this interview context (403).");
        } else if (status === 422) {
          setErrorMessage("Invalid parameters requested for fit/gap analysis (422).");
        } else {
          setErrorMessage("Failed to load interview context. Please check your connection.");
        }
      })
      .finally(() => setLoading(false));
  }, [sessionId, vacancyId]);

  useEffect(() => {
    if (portfolio) fetchReport();
  }, [portfolio, fetchReport]);

  usePolling(fetchReport, 4000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    setErrorMessage(null);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      setGenerating(true);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 422) {
        setErrorMessage("Cannot regenerate report: Portfolio has unaddressed or incomplete items (422).");
      } else if (status === 403) {
        setErrorMessage("Access denied. You do not have permission to regenerate this report (403).");
      } else {
        setErrorMessage("Could not request report regeneration. Please try again.");
      }
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
      const ext = format;
      const blob =
        format === "pdf"
          ? new Blob([res.data as BlobPart], { type: "application/pdf" })
          : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeSlug = session?.candidate_name
        ? session.candidate_name.toLowerCase().replace(/[^a-z0-9_-]/gi, "-").replace(/-+/g, "-")
        : sessionId;
      a.download = `fitgap-${safeSlug}-${vacancyId}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  };

  // Compute Match Score
  const totalSkills = report?.skill_comparisons?.length || 0;
  const matchCount = report?.skill_comparisons?.filter((c) => c.result === "match").length || 0;
  const exceedCount = report?.skill_comparisons?.filter((c) => c.result === "exceed").length || 0;
  const gapCount = report?.skill_comparisons?.filter((c) => c.result === "gap").length || 0;
  const matchPercentage = totalSkills > 0 ? Math.round(((matchCount + exceedCount) / totalSkills) * 100) : 0;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header Bar */}
      <FitGapHeader
        assessmentId={id || ""}
        sessionId={sessionId || ""}
        vacancyTitle={vacancy?.role_title}
        candidateName={session?.candidate_name}
        hasPortfolio={!!portfolio}
        hasReport={!!report}
        generating={generating}
        regenerating={regenerating}
        exporting={exporting}
        onRegenerate={handleRegenerate}
        onExport={handleExport}
      />

      {/* Error state */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-4 border border-destructive/30 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Generating indicator */}
      {generating && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <div>
            <p className="font-medium">Evaluating candidate against vacancy requirements...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Comparing assessed skill levels with role anchors and generating narrative summary.
            </p>
          </div>
        </div>
      )}

      {/* Report Content */}
      {report && (
        <>
          {/* Executive Summary Card */}
          <MatchSummaryCard
            matchPercentage={matchPercentage}
            matchCount={matchCount}
            exceedCount={exceedCount}
            gapCount={gapCount}
            totalSkills={totalSkills}
          />

          {/* Skill Comparison Table */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Competency Comparison</h2>
            <ComparisonTable comparisons={report.skill_comparisons} />
          </div>

          {/* Narrative Section */}
          <EvaluationNarrative
            overallNarrative={report.overall_narrative}
            cultureNarrative={report.culture_narrative}
          />

          {/* Discovered Skills (BUG-04 Fix) */}
          {portfolio && (
            <DiscoveredSkillsCard skills={portfolio.skills} />
          )}
        </>
      )}
    </div>
  );
}
