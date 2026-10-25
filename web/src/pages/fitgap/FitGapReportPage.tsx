import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { useGetPortfolio } from "@/useCases/sessions";
import { useGetFitGap, useTriggerFitGap, useExportPortfolio } from "@/useCases/portfolios";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap } from "lucide-react";
import type { Portfolio } from "@/types";

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [regenerating, setRegenerating] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [generationTriggered, setGenerationTriggered] = useState(false);

  const { data: portfolioData, isLoading: portfolioLoading } = useGetPortfolio(Number(sessionId));
  const portfolio: Portfolio | null = (portfolioData as any)?.portfolio ?? null;

  const {
    data: fitGapData,
    isLoading: fitGapLoading,
    refetch: refetchFitGap,
    error: fitGapError,
  } = useGetFitGap(portfolio?.id ?? 0, Number(vacancyId), { enabled: !!portfolio?.id });

  const report = regenerating ? null : fitGapData?.report ?? null;

  const triggerFitGap = useTriggerFitGap({ onSuccess: () => refetchFitGap() });
  const exportPortfolio = useExportPortfolio();

  const loading = portfolioLoading || (portfolio && fitGapLoading);
  const generating = !report && !!portfolio;

  useEffect(() => {
    if (!portfolio || !fitGapError || generationTriggered) return;
    if ((fitGapError as any)?.response?.status !== 404) return;
    setGenerationTriggered(true);
    triggerFitGap.mutate({ portfolioId: portfolio.id, vacancyId: Number(vacancyId) });
  }, [portfolio, fitGapError, generationTriggered, triggerFitGap, vacancyId]);

  usePolling(() => {
    void refetchFitGap();
  }, 5000, !report && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      await refetchFitGap();
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    exportPortfolio.mutate(
      { portfolioId: portfolio.id, format, vacancyId: Number(vacancyId) },
      {
        onSettled: () => setExporting(null),
        onSuccess: (data) => {
          const blob =
            format === "pdf"
              ? new Blob([data as BlobPart], { type: "application/pdf" })
              : new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `fitgap-${sessionId}-${vacancyId}.${format}`;
          a.click();
          URL.revokeObjectURL(url);
        },
      }
    );
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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-semibold truncate">Fit/Gap Report</h1>
          </div>
        </div>

        {portfolio && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                      <div key={s.id} className="text-sm flex items-start gap-2">
                        <span className="font-medium shrink-0">{s.skill_label}</span>
                        <span className="text-muted-foreground shrink-0">
                          {s.ai_level} (
                          {s.ai_confidence?.toLowerCase() === "low"
                            ? "low confidence"
                            : "confirmed"}
                          )
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
