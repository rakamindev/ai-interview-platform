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
import { cn } from "@/lib/utils";

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

  // guard flag ensuring we do not queue duplicate jobs on repeated 404 poll ticks
  const generationTriggeredRef = useRef(false);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
      generationTriggeredRef.current = false;
    } catch (e: any) {
      if (e?.response?.status === 404) {
        // trigger background job once and hold until completion
        if (!generationTriggeredRef.current) {
          generationTriggeredRef.current = true;
          try {
            await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
            setGenerating(true);
          } catch {
            setGenerating(false);
            generationTriggeredRef.current = false;
          }
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
      // mark job as in flight before dispatching request
      generationTriggeredRef.current = true;
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      setGenerating(true);
    } catch {
      generationTriggeredRef.current = false;
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(portfolio.id, format);
      if (format === "json") {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `fitgap-report-${portfolio.id}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const url = URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement("a");
        a.href = url;
        a.download = `fitgap-report-${portfolio.id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/sessions/${sessionId}/portfolio`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Fit / Gap Analysis</h1>
            <p className="text-sm text-muted-foreground">
              Candidate portfolio compared against role expectations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerating || generating}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", (regenerating || generating) && "animate-spin")} />
            Regenerate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("json")}
            disabled={exporting != null || generating || !report}
          >
            <Download className="h-4 w-4 mr-2" />
            JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
            disabled={exporting != null || generating || !report}
          >
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {generating && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6 flex items-center gap-3 text-blue-700 text-sm">
            <Loader2 className="h-5 w-5 animate-spin shrink-0" />
            <span>Analyzing candidate performance against vacancy requirements...</span>
          </CardContent>
        </Card>
      )}

      {report && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Executive Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              <div>
                <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Overall Recommendation
                </h4>
                <p>{report.overall_narrative}</p>
              </div>
              <Separator />
              <div>
                <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Cultural & Working Style Fit
                </h4>
                <p>{report.culture_narrative}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Skill Comparisons</CardTitle>
            </CardHeader>
            <CardContent>
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
