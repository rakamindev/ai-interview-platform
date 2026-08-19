import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingState } from "@/components/common/LoadingState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import { useUser } from "@/hooks/useUser";
import { useToast } from "@/hooks/useToast";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, Sparkles } from "lucide-react";
import type { FitGapReport, Portfolio } from "@/types";

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();
  const { canEdit } = useUser();
  const { success, error: toastError } = useToast();

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

  usePolling(fetchReport, 4000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      setGenerating(true);
      success("Regeneration started", "Recalculating competency benchmarks...");
    } catch {
      toastError("Failed to regenerate", "Please try again.");
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
      a.href = url;
      a.download = `fitgap-${sessionId}-${vacancyId}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      success("Export ready", `Downloaded fitgap-${sessionId}-${vacancyId}.${ext}`);
    } catch {
      toastError("Export failed", "Could not export report.");
    } finally {
      setExporting(null);
    }
  };

  if (loading) return <LoadingState rows={5} />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Role Fit/Gap Benchmark Report"
        description="Detailed delta analysis comparing evaluated competency levels against target vacancy expectations."
        backHref={`/assessments/${id}/sessions/${sessionId}/portfolio`}
        backLabel="Portfolio"
        actions={
          <div className="flex items-center gap-2">
            {canEdit && portfolio && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={regenerating || generating}
              >
                {regenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                )}
                Regenerate
              </Button>
            )}
            {report && (
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
                    <Download className="h-3.5 w-3.5 mr-1" />
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
                    <Download className="h-3.5 w-3.5 mr-1" />
                  )}
                  JSON
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Generating State */}
      {generating && (
        <Card className="p-12 text-center space-y-3 bg-muted/20 border-dashed">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm font-semibold text-foreground">
            Evaluating candidate competencies against role rubric...
          </p>
        </Card>
      )}

      {/* Report Content */}
      {report && (
        <div className="space-y-6">
          {/* Skill Comparison Table */}
          <Card className="shadow-xs overflow-hidden">
            <CardHeader className="p-4 pb-3 border-b bg-muted/20">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Skill Expectation vs Candidate Level Comparison</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          {/* Culture & Competency Narrative */}
          <Card className="shadow-xs">
            <CardHeader className="p-4 pb-3 border-b bg-muted/20">
              <CardTitle className="text-xs font-semibold">
                Culture Alignment &amp; Qualitative Assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {report.culture_narrative || report.overall_narrative}
              </p>
            </CardContent>
          </Card>

          {/* Discovered Skills Section */}
          {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
            <Card className="shadow-xs">
              <CardHeader className="p-4 pb-3 border-b bg-muted/20">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-amber-600">
                  <Zap className="h-4 w-4" />
                  <span>Additive Discovered Competencies</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {portfolio.skills
                  .filter((s) => s.is_discovered)
                  .map((s) => (
                    <div key={s.id} className="text-xs flex items-center justify-between p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{s.skill_label}</span>
                        <span className="text-muted-foreground text-[11px]">
                          ({s.ai_level})
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        Not in baseline vacancy rubric (additive value)
                      </span>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
