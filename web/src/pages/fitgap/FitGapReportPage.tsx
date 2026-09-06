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
import { CONFIDENCE_LABELS, LEVEL_LABELS } from "@/utils/constants";
import { AlertTriangle, ArrowLeft, Download, Loader2, RefreshCw, Zap } from "lucide-react";
import type { FitGapReport, Portfolio } from "@/types";

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
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // A skill is "additive" when the vacancy does not ask for it. Membership in
  // the comparison table is the test, because that table is built from the
  // vacancy's own skill list.
  const comparedLabels = new Set(
    (report?.skill_comparisons ?? []).map((c) => c.skill_label.trim().toLowerCase()),
  );
  const additiveSkills = (portfolio?.skills ?? []).filter(
    (s) => !comparedLabels.has(s.skill_label.trim().toLowerCase()),
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 space-y-1">
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

      {/* Generating */}
      {generating && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Generating fit/gap report...</p>
        </div>
      )}

      {/* Report ready */}
      {report && (
        <>
          {/* Skill comparison */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Skill Comparison</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          <Separator />

          {/* Narratives.
              Previously this card rendered `culture_narrative || overall_narrative`,
              so when the model call failed the rule-based count was presented to
              the reader as a qualitative culture assessment — and the overall
              recommendation had no heading of its own at all. Each narrative now
              appears only under its own heading, and a degraded report is
              labelled as degraded instead of impersonating a complete one. */}
          {report.narrative_degraded && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div>
                <p className="font-medium">Narrative analysis did not run</p>
                <p className="mt-0.5 text-amber-800">
                  The language model call failed, so only the rule-based comparison below is available. The skill
                  table is unaffected — it is computed from the portfolio and the vacancy without a model. Use
                  Regenerate to try the narrative again.
                </p>
              </div>
            </div>
          )}

          {report.culture_narrative && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Culture &amp; Competency Fit</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {report.culture_narrative}
                </p>
              </CardContent>
            </Card>
          )}

          {report.overall_narrative && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  {report.narrative_degraded ? "Rule-based Summary" : "Overall Assessment"}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {report.overall_narrative}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Skills assessed but not required by this vacancy.
              This panel used to select on `is_discovered` alone and hardcode
              "Not required for this role" — while the table above could be
              listing the same skill as a matched requirement, because a vacancy
              is free to require a skill the interview happened to discover. The
              vacancy is now the authority on what is required, so the two halves
              of the page can no longer contradict each other. */}
          {additiveSkills.length > 0 && (
            <>
              <Separator />
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Assessed beyond this vacancy&apos;s requirements
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {additiveSkills.map((s) => (
                    <div key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="font-medium">{s.skill_label}</span>
                      <span className="text-muted-foreground tabular-nums">{LEVEL_LABELS[s.ai_level]}</span>
                      {/* The confidence label is rendered verbatim. It used to be
                          collapsed to a boolean, which reported `medium` as
                          "confirmed" — inverting the one signal it carried. */}
                      <span className="text-xs text-muted-foreground">
                        {CONFIDENCE_LABELS[s.ai_confidence] ?? s.ai_confidence} confidence
                      </span>
                      <span className="text-xs text-muted-foreground">
                        · {s.evidence?.length ?? 0} {(s.evidence?.length ?? 0) === 1 ? "quote" : "quotes"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        — not required for this role, may be additive
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
