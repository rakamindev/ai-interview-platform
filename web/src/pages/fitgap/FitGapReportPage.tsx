import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import { AlertTriangle, ArrowLeft, Download, Info, Loader2, RefreshCw, Zap } from "lucide-react";
import type { FitGapReport, Portfolio, SkillComparison } from "@/types";

type ComparisonFilter = "all" | "gap" | "not_assessed" | "fit";

function fallbackSummary(comparisons: SkillComparison[]) {
  const gaps = comparisons.filter((c) => c.result === "gap");
  return {
    match_count: comparisons.filter((c) => c.result === "match").length,
    exceed_count: comparisons.filter((c) => c.result === "exceed").length,
    gap_count: gaps.length,
    not_assessed_count: comparisons.filter((c) => c.result === "not_assessed").length,
    priority_gaps: gaps.sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0)).map((c) => c.skill_label),
  };
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
  const [filter, setFilter] = useState<ComparisonFilter>("all");

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      const nextReport = res.data.report;
      setReport(nextReport);
      setGenerating(nextReport.narrative_status === "pending" || nextReport.narrative_status === "generating");
    } catch (e: any) {
      if (e?.response?.status === 404) {
        try {
          const triggerRes = await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          if ("report" in triggerRes.data) setReport(triggerRes.data.report);
          setGenerating(true);
        } catch {
          setGenerating(false);
        }
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
        }
      })
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
      const res = await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      if (res.data.report) setReport(res.data.report);
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
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const comparisons = report?.skill_comparisons ?? [];
  const summary = report?.summary ?? fallbackSummary(comparisons);
  const filteredComparisons = comparisons.filter((comparison) => {
    if (filter === "gap") return comparison.result === "gap";
    if (filter === "not_assessed") return comparison.result === "not_assessed";
    if (filter === "fit") return comparison.result === "match" || comparison.result === "exceed";
    return true;
  });
  const additionalSignals = report?.additional_skill_signals ?? portfolio?.skills
    .filter((skill) => skill.is_discovered)
    .map((skill) => ({
      skill_id: skill.skill_id?.toString(),
      skill_label: skill.skill_label,
      candidate_level: Number(skill.ai_level),
      confidence: skill.ai_confidence,
      is_override: false,
    })) ?? [];
  const narrativeStatus = report?.narrative_status ?? (report?.culture_narrative || report?.overall_narrative ? "complete" : "pending");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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
            <h1 className="text-lg font-semibold">Fit/Gap Report</h1>
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

      {/* Comparison generation */}
      {generating && (
        <div className="border rounded-lg px-4 py-3 flex items-center gap-3 bg-primary/5">
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          <p className="text-sm text-muted-foreground">
            {report ? "Comparison is ready. AI narrative is still generating." : "Preparing Fit/Gap comparison..."}
          </p>
        </div>
      )}

      {/* Comparison summary */}
      {report && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Comparison Summary</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg bg-green-50 px-3 py-2"><p className="text-xl font-semibold text-green-700">{summary.match_count}</p><p className="text-xs text-green-700">Match</p></div>
                <div className="rounded-lg bg-green-50 px-3 py-2"><p className="text-xl font-semibold text-green-700">{summary.exceed_count}</p><p className="text-xs text-green-700">Exceeds</p></div>
                <div className="rounded-lg bg-amber-50 px-3 py-2"><p className="text-xl font-semibold text-amber-700">{summary.gap_count}</p><p className="text-xs text-amber-700">Gap</p></div>
                <div className="rounded-lg bg-neutral-50 px-3 py-2"><p className="text-xl font-semibold text-neutral-600">{summary.not_assessed_count}</p><p className="text-xs text-neutral-600">Not assessed</p></div>
              </div>

              {summary.priority_gaps.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Priority gaps</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {summary.priority_gaps.map((skill) => <span key={skill} className="text-sm font-medium text-amber-900">{skill}</span>)}
                  </div>
                </div>
              )}

              {(report.caveats ?? []).length > 0 && (
                <div className="space-y-1.5">
                  {(report.caveats ?? []).map((caveat) => (
                    <p key={caveat} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {caveat}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm">Required Skill Comparison</CardTitle>
                <div className="flex flex-wrap gap-1">
                  {(["all", "gap", "not_assessed", "fit"] as ComparisonFilter[]).map((value) => (
                    <Button key={value} variant={filter === value ? "secondary" : "ghost"} size="sm" className="h-7 px-2 text-xs" onClick={() => setFilter(value)}>
                      {value === "not_assessed" ? "Unassessed" : value === "all" ? "All" : value === "fit" ? "Fit" : "Gaps"}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {filteredComparisons.length > 0 ? (
                <ComparisonTable comparisons={filteredComparisons} />
              ) : (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No skills match this filter.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm">AI Narrative</CardTitle>
                {narrativeStatus === "failed" && <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry</Button>}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {narrativeStatus === "failed" ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-destructive"><AlertTriangle className="h-4 w-4" /> Narrative unavailable</p>
                  <p className="mt-1 text-xs text-muted-foreground">Deterministic comparison remains valid. Retry narrative generation when ready.</p>
                </div>
              ) : narrativeStatus !== "complete" ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Narrative is being generated. Comparison remains available.</p>
              ) : (
                <div className="space-y-4">
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Culture &amp; competency</p><p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{report.culture_narrative || "No culture narrative available."}</p></div>
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overall context</p><p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{report.overall_narrative || "No overall narrative available."}</p></div>
                </div>
              )}
            </CardContent>
          </Card>

          {additionalSignals.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-1.5"><Zap className="h-4 w-4 text-amber-500" /> Additional Skill Signals</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {additionalSignals.map((skill) => (
                  <div key={`${skill.skill_id ?? "skill"}-${skill.skill_label}`} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{skill.skill_label}</span>
                    {skill.candidate_level != null && <span className="text-muted-foreground">L{skill.candidate_level}</span>}
                    {skill.confidence && <span className="text-xs text-muted-foreground">{skill.confidence} confidence</span>}
                    <span className="text-xs text-muted-foreground">Not required for this Vacancy.</span>
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
