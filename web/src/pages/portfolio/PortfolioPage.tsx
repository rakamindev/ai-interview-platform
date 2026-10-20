import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import SessionCoverageBanner from "@/components/portfolio/SessionCoverageBanner";
import UnassessedSkillsSection from "@/components/portfolio/UnassessedSkillsSection";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Zap,
  FileText,
  AlertCircle,
  Clock,
  Briefcase,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";

const MAX_POLL_ATTEMPTS = 12;

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [failedError, setFailedError] = useState<string | null>(null);
  const [notFoundError, setNotFoundError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [assessmentName, setAssessmentName] = useState<string | null>(null);

  const pollAttemptsRef = useRef(0);
  const latestRequestIdRef = useRef(0);

  const applyOverrideMap = useCallback((loadedPortfolio: Portfolio) => {
    const overrideMap: Record<number, AssessorOverride> = {};
    loadedPortfolio.overrides.forEach((o: AssessorOverride) => {
      overrideMap[o.portfolio_skill_id] = o;
    });
    setOverrides(overrideMap);
  }, []);

  const fetchPortfolio = useCallback(async () => {
    const requestId = ++latestRequestIdRef.current;
    try {
      const res = await sessionsApi.getPortfolio(Number(sessionId));
      if (requestId !== latestRequestIdRef.current) return;

      const data = res.data;
      setNotFoundError(null);

      if (data.status === "failed" || data.portfolio?.generation_status === "failed") {
        setGenerating(false);
        setTimedOut(false);
        setFailedError(
          data.error ??
            data.portfolio?.generation_error ??
            "Portfolio generation failed. Please retry generation."
        );
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        }
        return;
      }

      if (
        data.status === "generating" ||
        data.portfolio?.generation_status === "generating" ||
        data.portfolio?.generation_status === "pending"
      ) {
        pollAttemptsRef.current += 1;
        if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
          setGenerating(false);
          setTimedOut(true);
        } else {
          setGenerating(true);
          setTimedOut(false);
        }
        return;
      }

      if (data.portfolio) {
        pollAttemptsRef.current = 0;
        setPortfolio(data.portfolio);
        setGenerating(false);
        setTimedOut(false);
        setFailedError(null);
        applyOverrideMap(data.portfolio);
      }
    } catch (err: unknown) {
      if (requestId !== latestRequestIdRef.current) return;
      const status = (err as { response?: { status?: number } })?.response?.status;
      setGenerating(false);
      if (status === 404) {
        setNotFoundError("Session or portfolio could not be found in your workspace.");
      } else {
        setFailedError("Unable to load portfolio status. Please check your connection and try again.");
      }
    }
  }, [sessionId, applyOverrideMap]);

  useEffect(() => {
    pollAttemptsRef.current = 0;
    Promise.all([
      fetchPortfolio(),
      vacanciesApi.list().catch(() => ({ data: { vacancies: [] as Vacancy[] } })),
      sessionsApi.get(Number(sessionId)).catch(() => null),
    ])
      .then(([, vRes, sRes]) => {
        if (vRes?.data?.vacancies) {
          setVacancies(vRes.data.vacancies);
        }
        if (sRes?.data?.session) {
          setCandidateName(sRes.data.session.candidate_name ?? null);
        }
        if (sRes?.data?.assessment) {
          setAssessmentName(sRes.data.assessment.name ?? null);
        }
      })
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  // Poll while generating and not timed out
  usePolling(fetchPortfolio, 5000, generating && !timedOut);

  const handleCheckStatusNow = async () => {
    pollAttemptsRef.current = 0;
    setTimedOut(false);
    await fetchPortfolio();
  };

  const handleRestartGeneration = async () => {
    setRetrying(true);
    try {
      await sessionsApi.regeneratePortfolio(Number(sessionId));
      pollAttemptsRef.current = 0;
      setFailedError(null);
      setTimedOut(false);
      setGenerating(true);
      toast.info("Regenerating AI candidate portfolio...", "Portfolio");
    } catch {
      setFailedError("Could not trigger portfolio regeneration. Please try again.");
      toast.error("Could not trigger portfolio regeneration.", "Error");
    } finally {
      setRetrying(false);
    }
  };

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
      toast.success(`Portfolio report downloaded as ${format.toUpperCase()}!`, "Export Complete");
    } catch {
      toast.error("Failed to export candidate portfolio.", "Export Error");
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading candidate portfolio"
        className="w-full space-y-4"
      >
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const configuredAssessedSkills = portfolio?.skills.filter((s) => !s.is_discovered) ?? [];
  const discoveredSkills = portfolio?.skills.filter((s) => s.is_discovered) ?? [];
  const resolvedCandidateName =
    candidateName || portfolio?.session_summary?.candidate_name || null;
  const activeOverrideCount = Object.keys(overrides).length;
  const isComplete = !generating && !timedOut && !notFoundError && portfolio?.generation_status === "complete";

  return (
    <div className="w-full space-y-6 pb-10">
      {/* 1. Navigation/breadcrumb + 2. Candidate/assessment title & context + 3. Primary & secondary actions */}
      <div className="rounded-[10px] border border-[#E2E8F0] bg-white p-4 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <Link
              to={`/assessments/${id}/invite`}
              aria-label="Back to assessment invites"
              className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F7F9FA] hover:text-[#1F2937] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-medium text-[#64748B]">
                Candidate Assessment Review
              </p>
              <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight text-[#1F2937] leading-tight">
                {resolvedCandidateName ? `${resolvedCandidateName} — Portfolio Results` : "Portfolio Results"}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-[#64748B]">
                {assessmentName && (
                  <span className="font-medium text-[#1F2937] break-words">
                    {assessmentName}
                  </span>
                )}
                {assessmentName && portfolio?.generated_at && (
                  <span aria-hidden="true">·</span>
                )}
                {portfolio?.generated_at && (
                  <span className="text-xs text-[#64748B]">
                    Session #{sessionId}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Secondary actions: Transcript, PDF, JSON */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/transcript`}
              className="inline-flex items-center gap-1.5 text-xs font-medium border border-[#E2E8F0] bg-white text-[#1F2937] rounded-md px-3 h-8 hover:bg-[#F7F9FA] transition-colors shadow-2xs"
            >
              <FileText className="h-3.5 w-3.5 text-[#64748B]" />
              Transcript
            </Link>
            {isComplete && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("pdf")}
                  disabled={!!exporting}
                >
                  {exporting === "pdf" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1 text-[#64748B]" />
                  )}
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("json")}
                  disabled={!!exporting}
                >
                  {exporting === "json" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1 text-[#64748B]" />
                  )}
                  JSON
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 3b. Primary workflow action bar: Vacancy Fit/Gap comparison */}
        {isComplete && (
          <div className="pt-3.5 border-t border-dashed border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-[#64748B]">
              <Briefcase className="h-4 w-4 text-[#0F8F95] shrink-0" aria-hidden="true" />
              <span>
                Compare effective skill ratings (including any human overrides) against a target role&apos;s requirements:
              </span>
            </div>

            {vacancies.length === 0 ? (
              <p className="text-xs text-[#64748B]">
                No open vacancies configured yet.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                  <SelectTrigger
                    className="w-full sm:w-60 h-9 bg-white border-[#E2E8F0] text-xs sm:text-sm"
                    aria-label="Select vacancy for Fit/Gap analysis"
                  >
                    <SelectValue placeholder="Choose target vacancy..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vacancies.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.role_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleRunFitGap}
                  disabled={!selectedVacancy}
                  className="w-full sm:w-auto h-9 text-xs sm:text-sm"
                >
                  Run Fit/Gap Analysis →
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Not Found state */}
      {notFoundError && (
        <div role="alert" className="border border-destructive/40 bg-white rounded-[10px] p-6 text-center space-y-3">
          <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
          <p className="text-sm font-medium text-destructive">{notFoundError}</p>
          <Link
            to="/assessments"
            className="inline-flex items-center text-xs underline text-[#64748B] hover:text-[#1F2937]"
          >
            Return to assessments
          </Link>
        </div>
      )}

      {/* Generating state */}
      {generating && !timedOut && (
        <div role="status" aria-live="polite" className="border border-[#E2E8F0] rounded-[10px] bg-white p-8 sm:p-10 text-center space-y-3">
          <Loader2 className="h-7 w-7 animate-spin text-[#0F8F95] mx-auto" />
          <div>
            <p className="font-semibold text-[#1F2937]">Generating portfolio...</p>
            <p className="text-sm text-[#64748B] mt-1">
              The AI is analyzing the interview transcript. This typically takes 1–2 minutes.
            </p>
          </div>
        </div>
      )}

      {/* Polling Timeout state (role="status": not a confirmed backend failure) */}
      {timedOut && (
        <div
          role="status"
          aria-live="polite"
          className="border border-amber-300 bg-amber-50/70 rounded-[10px] p-6 text-center space-y-3"
        >
          <Clock className="h-6 w-6 text-amber-600 mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-900">
              Portfolio analysis is still processing in the background
            </p>
            <p className="text-xs text-amber-800 max-w-xl mx-auto leading-relaxed">
              Automatic status polling has paused because analysis is taking longer than usual. You can check the latest status without starting a duplicate job, or restart generation.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={handleCheckStatusNow}>
              Check Status
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRestartGeneration}
              disabled={retrying}
            >
              {retrying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Restart Generation
            </Button>
          </div>
        </div>
      )}

      {/* Failed state */}
      {!generating && !timedOut && !notFoundError && (failedError || portfolio?.generation_status === "failed") && (
        <div role="alert" className="border border-destructive/40 bg-white rounded-[10px] p-6 text-center space-y-3">
          <AlertCircle className="h-6 w-6 text-destructive mx-auto" />
          <p className="text-sm font-medium text-destructive">
            {failedError ?? "Portfolio generation failed."}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestartGeneration}
            disabled={retrying}
          >
            {retrying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Retry Generation
          </Button>
        </div>
      )}

      {/* Ready state */}
      {isComplete && portfolio && (
        <>
          {/* 4. Compact session-completeness summary */}
          {portfolio.session_summary && (
            <SessionCoverageBanner summary={portfolio.session_summary} />
          )}

          {/* 5. Skill assessment content (Assessed Configured Skills) */}
          <section aria-label="Assessed configured skills" className="space-y-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="space-y-0.5">
                <h2 className="text-[18px] sm:text-[20px] font-semibold tracking-tight text-[#1F2937]">
                  Assessed Configured Skills ({configuredAssessedSkills.length})
                </h2>
                <p className="text-[13px] text-[#64748B]">
                  Skills that reached 2+ interview probes with behavioral evidence. Assessors can override any AI rating with a documented rationale.
                </p>
              </div>
              {activeOverrideCount > 0 && (
                <span className="inline-flex items-center text-xs font-medium text-[#0B7479] bg-[#0F8F95]/10 border border-[#0F8F95]/25 px-2.5 py-0.5 rounded-md">
                  {activeOverrideCount} human override{activeOverrideCount !== 1 ? "s" : ""} active
                </span>
              )}
            </div>
            {configuredAssessedSkills.length === 0 ? (
              <div className="border border-dashed border-slate-300 bg-white rounded-[10px] p-6 text-xs text-[#64748B] text-center">
                No configured skills reached the minimum evidence threshold (2+ probes) during this session.
              </div>
            ) : (
              <div
                className={
                  configuredAssessedSkills.length > 1
                    ? "grid grid-cols-1 lg:grid-cols-2 gap-4 items-start"
                    : "space-y-4"
                }
              >
                {configuredAssessedSkills.map((skill) => (
                  <SkillPortfolioCard
                    key={skill.id}
                    skill={skill}
                    override={overrides[skill.id]}
                    onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 5b. Discovered skills (if any) */}
          {discoveredSkills.length > 0 && (
            <>
              <Separator className="bg-[#E2E8F0]" />
              <section aria-label="Discovered skills" className="space-y-3.5">
                <div className="space-y-0.5">
                  <h2 className="text-[18px] sm:text-[20px] font-semibold tracking-tight text-[#1F2937] flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" aria-hidden="true" />
                    Discovered Skills ({discoveredSkills.length})
                  </h2>
                  <p className="text-[13px] text-[#64748B]">
                    Additional competencies explored during the interview outside the target rubric.
                  </p>
                </div>
                <div
                  className={
                    discoveredSkills.length > 1
                      ? "grid grid-cols-1 lg:grid-cols-2 gap-4 items-start"
                      : "space-y-4"
                  }
                >
                  {discoveredSkills.map((skill) => (
                    <SkillPortfolioCard
                      key={skill.id}
                      skill={skill}
                      override={overrides[skill.id]}
                      onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                    />
                  ))}
                </div>
              </section>
            </>
          )}

          {/* 6. Clearly separated unassessed information */}
          {portfolio.unassessed_skills && portfolio.unassessed_skills.length > 0 && (
            <>
              <Separator className="bg-[#E2E8F0]" />
              <UnassessedSkillsSection skills={portfolio.unassessed_skills} />
            </>
          )}
        </>
      )}
    </div>
  );
}



