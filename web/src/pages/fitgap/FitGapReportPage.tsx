import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap } from "lucide-react";
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
  const triggeredInitialRef = useRef(false);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      if (res.status === 202 || res.data?.status === "generating") {
        setGenerating(true);
        return;
      }
      if (res.data?.report) {
        setReport(res.data.report);
        setGenerating(false);
      }
    } catch (e: any) {
      if (e?.response?.status === 202 || e?.response?.data?.status === "generating") {
        setGenerating(true);
        return;
      }

      if (e?.response?.status === 404 && !triggeredInitialRef.current) {
        triggeredInitialRef.current = true;
        try {
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          setGenerating(true);
        } catch {
          setGenerating(false);
        }
      } else if (e?.response?.status === 404) {
        // Already triggered once; background worker is still processing
        setGenerating(true);
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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to={sessionId ? `/sessions/${sessionId}/portfolio` : "/"}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-sm text-muted-foreground">Portfolio</span>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-sm font-medium">Fit/Gap Report</span>
          </div>
          <h1 className="text-xl font-semibold">Vacancy Fit/Gap Evaluation</h1>
        </div>

        {report && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating || generating}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 ${
                  regenerating || generating ? "animate-spin" : ""
                }`}
              />
              Regenerate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("pdf")}
              disabled={exporting !== null}
            >
              {exporting === "pdf" ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1.5" />
              )}
              Export PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("json")}
              disabled={exporting !== null}
            >
              {exporting === "json" ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1.5" />
              )}
              JSON
            </Button>
          </div>
        )}
      </div>

      {/* Generating state */}
      {generating && (
        <div className="border rounded-lg p-12 text-center space-y-3 bg-muted/20">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium text-foreground">Analyzing role requirements &amp; candidate evidence...</p>
          <p className="text-xs text-muted-foreground">
            Comparing competency levels, applying human assessor overrides, and summarizing fit.
          </p>
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

          {/* Overall Narrative */}
          {report.overall_narrative && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Overall Hiring Recommendation</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {report.overall_narrative}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Culture & competency */}
          {report.culture_narrative && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Culture &amp; Competency Fit</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {report.culture_narrative}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Discovered skills */}
          {portfolio && portfolio.skills?.some((s) => s.is_discovered) && (
            <>
              <Separator />
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Additional Candidate Strengths (Discovered during interview)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {portfolio.skills
                    .filter((s) => s.is_discovered)
                    .map((s) => (
                      <div key={s.id} className="text-sm flex items-center justify-between border-b last:border-0 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{s.skill_label}</span>
                          <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                            Level {s.ai_level}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Spontaneously demonstrated by candidate
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
