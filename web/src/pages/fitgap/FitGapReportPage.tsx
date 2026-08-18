import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState, LoadingBlock } from "@/components/shared/EmptyState";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, BarChart3 } from "lucide-react";
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
      <div className="max-w-5xl space-y-6">
        <LoadingBlock rows={2} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        breadcrumb={
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to portfolio
          </Link>
        }
        title="Fit/Gap Report"
        description="Compare candidate skill levels against vacancy requirements."
        actions={
          portfolio ? (
            <>
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
            </>
          ) : undefined
        }
      />

      {generating && (
        <div className="rounded-xl border bg-muted/20 px-6 py-12 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Generating fit/gap report...</p>
        </div>
      )}

      {!generating && !report && portfolio && (
        <EmptyState
          icon={BarChart3}
          title="Report not available"
          description="Fit/gap analysis could not be loaded. Try regenerating the report."
          action={
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating}>
              {regenerating ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Regenerate
            </Button>
          }
        />
      )}

      {!generating && !portfolio && (
        <EmptyState
          icon={BarChart3}
          title="Portfolio required"
          description="A completed portfolio is needed before running fit/gap analysis."
        />
      )}

      {report && (
        <>
          <Card className="shadow-none">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Decision note
              </p>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Use this report after portfolio review. <span className="text-foreground font-medium">Not assessed</span> means
                the interview did not produce enough evidence for that vacancy skill.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Skill Comparison</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Culture &amp; Competency Fit</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-sm leading-relaxed text-foreground break-anywhere whitespace-pre-wrap">
                {report.culture_narrative || report.overall_narrative}
              </p>
            </CardContent>
          </Card>

          {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
            <>
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
                      <div key={s.id} className="text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium break-anywhere">{s.skill_label}</span>
                        <span className="text-muted-foreground">
                          {s.ai_level} ({s.ai_confidence?.toLowerCase() === "low" ? "low confidence" : "confirmed"})
                        </span>
                        <span className="text-xs text-muted-foreground">
                          — Not required for this role, may be additive.
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
