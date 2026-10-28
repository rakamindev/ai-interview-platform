import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { usePolling } from "@/hooks/usePolling";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Zap,
  Sparkles,
  FileText,
  Target,
  Award,
} from "lucide-react";
import type { FitGapReport, Portfolio } from "@/types";

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [roleTitle, setRoleTitle] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        try {
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          setGenerating(true);
        } catch {
          setGenerating(false);
        }
      }
    }
  }, [portfolio, vacancyId]);

  useEffect(() => {
    Promise.all([
      sessionsApi.getPortfolio(Number(sessionId)),
      sessionsApi.get(Number(sessionId)),
      vacancyId ? vacanciesApi.get(Number(vacancyId)) : Promise.resolve(null),
    ])
      .then(([pRes, sRes, vRes]) => {
        const pData = pRes.data as any;
        if (pData.portfolio) setPortfolio(pData.portfolio);
        if (sRes?.data?.session?.candidate_name) setCandidateName(sRes.data.session.candidate_name);
        if (vRes?.data?.vacancy?.role_title) setRoleTitle(vRes.data.vacancy.role_title);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId, vacancyId]);

  useEffect(() => {
    if (portfolio) fetchReport();
  }, [portfolio, fetchReport]);

  usePolling(fetchReport, 5000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
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
      const res = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
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

  // Executive calculations
  const comparisons = report?.skill_comparisons ?? [];
  const totalSkills = comparisons.length;
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const metCount = matchCount + exceedCount;
  const matchRate = totalSkills > 0 ? Math.round((metCount / totalSkills) * 100) : 0;

  let recommendation = {
    label: "Strong Fit",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    summary: "Candidate meets or exceeds critical role requirements.",
  };

  if (matchRate < 50) {
    recommendation = {
      label: "Significant Gaps",
      color: "bg-red-50 text-red-700 border-red-200",
      summary: "Major upskilling required across primary core competencies.",
    };
  } else if (matchRate < 75 || gapCount > 1) {
    recommendation = {
      label: "Moderate Fit / Gaps Present",
      color: "bg-amber-50 text-amber-700 border-amber-200",
      summary: "Qualified for core tasks; secondary skills may need ramp-up.",
    };
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Portfolio</span>
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Fit/Gap Evaluation Report</h1>
          <p className="text-sm text-muted-foreground">
            Target Role: <span className="font-semibold text-foreground">{roleTitle ?? "Configured Vacancy"}</span>
            {candidateName && <> · Candidate: <span className="font-semibold text-foreground">{candidateName}</span></>}
          </p>
        </div>

        {portfolio && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || generating}>
              {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Regenerate
            </Button>
            {report && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting}>
                  {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!!exporting}>
                  {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                  JSON
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Generating */}
      {generating && (
        <div className="border rounded-lg p-12 text-center space-y-3 bg-muted/10">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium text-foreground">Generating fit/gap report...</p>
          <p className="text-xs text-muted-foreground">Synthesizing interview evidence against vacancy benchmarks.</p>
        </div>
      )}

      {/* Report ready */}
      {report && (
        <>
          {/* Executive Summary Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border shadow-xs">
              <CardContent className="p-4 space-y-1.5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Role Benchmark</span>
                  <Target className="h-4 w-4 text-primary" />
                </div>
                <div className="text-xl font-bold truncate text-foreground">{roleTitle || "Role Vacancy"}</div>
                <p className="text-xs text-muted-foreground">
                  Benchmarked on {totalSkills} required skills
                </p>
              </CardContent>
            </Card>

            <Card className="border shadow-xs">
              <CardContent className="p-4 space-y-1.5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Match Rate</span>
                  <Award className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-foreground">{matchRate}%</span>
                  <span className="text-xs text-muted-foreground">({metCount}/{totalSkills} met)</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-500"
                    style={{ width: `${matchRate}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-xs">
              <CardContent className="p-4 space-y-1.5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Fit Status</span>
                  <Sparkles className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border", recommendation.color)}>
                    {recommendation.label}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                  {recommendation.summary}
                </p>
              </CardContent>
            </Card>

            <Card className="border shadow-xs">
              <CardContent className="p-4 space-y-1.5">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Skills Breakdown</span>
                  <span className="text-xs font-mono font-medium">{totalSkills} Total</span>
                </div>
                <div className="flex items-center gap-2 text-xs flex-wrap pt-0.5">
                  <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium border border-green-200">
                    {matchCount} Match
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                    {exceedCount} Exceeds
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium border border-amber-200">
                    {gapCount} Gap
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground pt-0.5">
                  Assessed with LLM verification
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Skill comparison */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Skill Comparison Matrix</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Direct evaluation of candidate's verified capability vs role requirements.
                </p>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          <Separator />

          {/* Culture & competency */}
          {report.culture_narrative && (
            <Card className="border-l-4 border-l-primary/70 shadow-xs">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Culture &amp; Competency Fit
                  </CardTitle>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    AI Objective Synthesis
                  </span>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-5 pt-1">
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {report.culture_narrative}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Overall hiring narrative */}
          {report.overall_narrative && (
            <Card className="border-l-4 border-l-blue-500/70 shadow-xs">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Overall Hiring Assessment
                  </CardTitle>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    Hiring Recommendation
                  </span>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-5 pt-1">
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {report.overall_narrative}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Discovered skills */}
          {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
            <>
              <Separator />
              <Card className="shadow-xs border-amber-200/60 bg-amber-50/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 font-semibold text-amber-900">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Discovered Skills (Outside Vacancy Requirements)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-5 space-y-2.5">
                  {portfolio.skills
                    .filter((s) => s.is_discovered)
                    .map((s) => (
                      <div key={s.id} className="text-sm flex items-center gap-2 bg-white/80 border rounded p-2.5">
                        <span className="font-semibold text-foreground">{s.skill_label}</span>
                        <span className="text-muted-foreground font-mono text-xs px-2 py-0.5 bg-muted rounded">
                          L{s.ai_level} ({s.ai_confidence?.toLowerCase() === "low" ? "low confidence" : "confirmed"})
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          Not strictly required for this role — additive candidate asset.
                        </span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* Empty / Not ready state */}
      {!generating && !report && (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center space-y-3">
            <p className="text-base font-medium text-foreground">No Fit/Gap Report Generated Yet</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              A fit/gap comparison benchmarks this candidate's verified skills against the target vacancy requirements.
              Click the button below to generate the analysis.
            </p>
            <Button size="sm" onClick={handleRegenerate} disabled={regenerating}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Generate Fit/Gap Report
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

