import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  Download,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import type { FitGapReport, FitGapSummary, Portfolio, SkillComparison } from "@/types";

function buildFallbackSummary(comparisons: SkillComparison[]): FitGapSummary {
  const total = comparisons.length;
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const exceedCount = comparisons.filter((c) => c.result === "exceed").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const notAssessedCount = comparisons.filter((c) => c.result === "not_assessed").length;
  const lowConfidenceCount = comparisons.filter((c) => c.confidence?.toLowerCase() === "low").length;
  const overrideCount = comparisons.filter((c) => c.is_override).length;
  const criticalGapCount = comparisons.filter((c) => (c.delta ?? 0) <= -2).length;
  const readinessScore = total === 0 ? 0 : Math.round(((matchCount + exceedCount) / total) * 100);
  const riskLevel = notAssessedCount > 0 || criticalGapCount > 0 || readinessScore < 70
    ? "high"
    : gapCount > 0 || lowConfidenceCount > 0 || readinessScore < 85
      ? "medium"
      : "low";

  return {
    total_required: total,
    assessed_count: total - notAssessedCount,
    match_count: matchCount,
    exceed_count: exceedCount,
    gap_count: gapCount,
    not_assessed_count: notAssessedCount,
    low_confidence_count: lowConfidenceCount,
    override_count: overrideCount,
    critical_gap_count: criticalGapCount,
    readiness_score: readinessScore,
    risk_level: riskLevel,
    recommendation: riskLevel === "low"
      ? "Strong fit signal. Proceed with assessor review and validate the strongest evidence."
      : riskLevel === "medium"
        ? "Conditional fit signal. Review gaps, low-confidence evidence, and human overrides before deciding."
        : "High-risk or insufficient fit signal. Re-assess flagged skills before advancing the candidate.",
    flags: [
      notAssessedCount > 0 ? `${notAssessedCount} required skill(s) not assessed` : null,
      criticalGapCount > 0 ? `${criticalGapCount} critical gap(s) of two or more levels` : null,
      lowConfidenceCount > 0 ? `${lowConfidenceCount} low-confidence assessed skill(s)` : null,
      overrideCount > 0 ? `${overrideCount} human override(s) applied` : null,
      total === 0 ? "No vacancy skills were configured" : null,
    ].filter(Boolean) as string[],
  };
}

function riskStyles(riskLevel: FitGapSummary["risk_level"]) {
  if (riskLevel === "low") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (riskLevel === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function readinessColor(score: number) {
  if (score >= 85) return "bg-emerald-500";
  if (score >= 70) return "bg-amber-500";
  return "bg-red-500";
}

function formatLevel(level: string | number) {
  const value = String(level);
  return value.startsWith("L") ? value : `L${value}`;
}

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      setLoadError(null);
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
          setLoadError("Fit/gap report could not be queued. Check vacancy data and try again.");
        }
      } else {
        setLoadError("Fit/gap report could not be loaded. Try refreshing the report.");
      }
    }
  }, [portfolio, vacancyId]);

  useEffect(() => {
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then(async (res) => {
        const data = res.data as any;
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        } else if (data.status === "generating") {
          setLoadError("Portfolio is still generating. Wait until the candidate portfolio is ready.");
        } else {
          setLoadError("No completed portfolio is available for this session.");
        }
      })
      .catch(() => setLoadError("Portfolio could not be loaded. Check the session and try again."))
      .finally(() => setLoading(false));
  }, [sessionId]);

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

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-9 w-72" />
        <div className="grid gap-3 md:grid-cols-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const summary = report?.comparison_summary || (report ? buildFallbackSummary(report.skill_comparisons) : null);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-semibold">Fit/Gap Report</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Decision support for comparing candidate evidence against vacancy requirements.
          </p>
        </div>

        {portfolio && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || generating}>
              {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Regenerate
            </Button>
            {report && (
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
          </div>
        )}
      </div>

      {loadError && !report && !generating && (
        <Card className="rounded-lg border-amber-200 bg-amber-50/70 shadow-none">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
            <div>
              <p className="text-sm font-medium text-amber-900">Report unavailable</p>
              <p className="text-sm text-amber-800">{loadError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {generating && (
        <Card className="rounded-lg shadow-none">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium">Generating fit/gap report</p>
              <p className="text-sm text-muted-foreground">The page will refresh when the report is ready.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {report && summary && (
        <>
          <div className="grid gap-3 md:grid-cols-[1.35fr_1fr_1fr_1fr]">
            <Card className="rounded-lg shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm">Decision Readiness</CardTitle>
                    <CardDescription>{summary.assessed_count} of {summary.total_required} required skills assessed</CardDescription>
                  </div>
                  <Badge variant="outline" className={cn("capitalize", riskStyles(summary.risk_level))}>
                    {summary.risk_level} risk
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-semibold">{summary.readiness_score}</span>
                  <span className="pb-1 text-sm text-muted-foreground">/ 100</span>
                </div>
                <Progress
                  value={summary.readiness_score}
                  indicatorClassName={readinessColor(summary.readiness_score)}
                />
              </CardContent>
            </Card>

            <Card className="rounded-lg shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Fit Signals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Match</span><strong>{summary.match_count}</strong></div>
                <div className="flex justify-between"><span>Exceeds</span><strong>{summary.exceed_count}</strong></div>
              </CardContent>
            </Card>

            <Card className="rounded-lg shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Gaps
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Any gap</span><strong>{summary.gap_count}</strong></div>
                <div className="flex justify-between"><span>Critical</span><strong>{summary.critical_gap_count}</strong></div>
              </CardContent>
            </Card>

            <Card className="rounded-lg shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CircleDashed className="h-4 w-4 text-neutral-600" />
                  Unknowns
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Not assessed</span><strong>{summary.not_assessed_count}</strong></div>
                <div className="flex justify-between"><span>Low confidence</span><strong>{summary.low_confidence_count}</strong></div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-lg shadow-none">
            <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_1.2fr]">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  Assessor recommendation
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{summary.recommendation}</p>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Review flags</div>
                {summary.flags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {summary.flags.map((flag) => (
                      <Badge key={flag} variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                        {flag}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No high-risk flags were detected by the deterministic summary.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Skill Comparison</CardTitle>
              <CardDescription>Required vacancy level compared with candidate evidence and assessor overrides.</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          <Card className="rounded-lg shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                Culture &amp; Competency Fit
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {report.culture_narrative || report.overall_narrative}
              </p>
              {report.culture_narrative && report.overall_narrative && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Overall recommendation narrative</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{report.overall_narrative}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
            <Card className="rounded-lg shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Discovered Skills
                </CardTitle>
                <CardDescription>Signals found during interview that were not configured as vacancy requirements.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 px-4 pb-4 md:grid-cols-2">
                {portfolio.skills
                  .filter((s) => s.is_discovered)
                  .map((s) => (
                    <div key={s.id} className="rounded-lg border p-3 text-sm">
                      <div className="font-medium">{s.skill_label}</div>
                      <div className="mt-1 text-muted-foreground">
                        {formatLevel(s.ai_level)} - {s.ai_confidence?.toLowerCase() === "low" ? "low confidence" : "confirmed"}
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
