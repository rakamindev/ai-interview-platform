import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap } from "lucide-react";
import type { FitGapReport, Portfolio } from "@/types";

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();
  const [searchParams] = useSearchParams();
  const portfolioRevisionId = searchParams.get("portfolio_revision_id");
  const selectedRevisionId = portfolioRevisionId ? Number(portfolioRevisionId) : undefined;

  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [assessmentName, setAssessmentName] = useState<string | null>(null);
  const [vacancyName, setVacancyName] = useState<string | null>(null);
  const viewingHistoricalReport = selectedRevisionId !== undefined;
  const overriddenSkillLabels = new Set(
    (portfolio?.overrides ?? [])
      .map((override) => portfolio?.skills.find((skill) => skill.id === override.portfolio_skill_id)?.skill_label)
      .filter((label): label is string => Boolean(label))
  );

  const loadReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId), selectedRevisionId);
      setReport(res.data.report);
      setGenerating(false);
    } catch (e: any) {
      if (e?.response?.status !== 404) setGenerating(false);
    }
  }, [portfolio, vacancyId, selectedRevisionId]);

  const ensureReport = useCallback(async () => {
    if (!portfolio) return;

    try {
      const res = await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId), selectedRevisionId);
      if ("report" in res.data) {
        setReport(res.data.report);
        setGenerating(false);
      } else {
        setGenerating(true);
      }
    } catch {
      setGenerating(false);
    }
  }, [portfolio, vacancyId, selectedRevisionId]);

  useEffect(() => {
    Promise.all([
      sessionsApi.getPortfolio(Number(sessionId)),
      sessionsApi.get(Number(sessionId)),
      vacanciesApi.get(Number(vacancyId)),
    ])
      .then(([portfolioRes, sessionRes, vacancyRes]) => {
        const portfolioData = portfolioRes.data as any;
        if (portfolioData.portfolio) {
          setPortfolio(portfolioData.portfolio);
        }
        setCandidateName(sessionRes.data.session.candidate_name ?? null);
        setAssessmentName(sessionRes.data.assessment.name ?? null);
        setVacancyName(vacancyRes.data.vacancy.role_title);
      })
      .finally(() => setLoading(false));
  }, [sessionId, vacancyId]);

  useEffect(() => {
    if (portfolio) ensureReport();
  }, [portfolio, ensureReport]);

  usePolling(loadReport, 5000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId), selectedRevisionId);
      setReport(null);
      setGenerating(true);
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        Number(vacancyId),
        report?.portfolio_revision_id
      );
      const ext = format;
      const blob = format === "pdf"
        ? new Blob([res.data as BlobPart], { type: "application/pdf" })
        : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitgap-${sessionId}-${vacancyId}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold">Fit/Gap Report</h1>
              {report && (
                <p className="text-xs text-muted-foreground mt-1">
                  Based on: {viewingHistoricalReport
                    ? `Portfolio v${report.portfolio_version ?? selectedRevisionId}`
                    : "Current portfolio"}
                </p>
              )}
              {vacancyName && <p className="text-xs text-muted-foreground">Vacancy: {vacancyName}</p>}
              {assessmentName && <p className="text-xs text-muted-foreground">Assessment: {assessmentName}</p>}
              {candidateName && (
                <p className="text-xs text-muted-foreground">
                  Candidate: {candidateName}
                </p>
              )}
            </div>
          </div>
        </div>

        {portfolio && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || generating}>
              {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Regenerate
            </Button>
            {report && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={!!exporting}>
                      {exporting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                      Download
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExport("pdf")}>
                      Download PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("json")}>
                      Download JSON
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        )}
      </div>

      {/* Generating */}
      {generating && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Generating fit/gap report...</p>
        </div>
      )}

      {/* Report ready */}
      {report && (
        <div className="max-w-4xl space-y-6">
          {/* Skill comparison */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Skill Comparison</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ComparisonTable
                comparisons={report.skill_comparisons}
                overriddenSkillLabels={overriddenSkillLabels}
              />
            </CardContent>
          </Card>

          <Separator />

          {/* Culture & competency */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Culture &amp; Competency Fit</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {report.culture_narrative || report.overall_narrative}
              </p>
            </CardContent>
          </Card>

          {/* Discovered skills */}
          {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
            <div className="space-y-3">
              <Separator />
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Discovered Skills (not in vacancy requirements)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {portfolio.skills
                    .filter((s) => s.is_discovered)
                    .map((s) => (
                      <div key={s.id} className="text-sm flex items-center gap-2">
                        <span className="font-medium">{s.skill_label}</span>
                        <span className="text-muted-foreground">
                          {s.ai_level} ({s.ai_confidence?.toLowerCase() === "low" ? "low confidence" : "confirmed"})
                        </span>
                        <span className="text-xs text-muted-foreground">— Not required for this role, may be additive.</span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
