import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import FitGapHistorySidebar from "@/components/fitgap/FitGapHistorySidebar";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap } from "lucide-react";
import type { FitGapSnapshot, Portfolio } from "@/types";

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [history, setHistory] = useState<FitGapSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<FitGapSnapshot | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const loadHistory = useCallback(
    async (portfolioId: number) => {
      try {
        const res = await portfoliosApi.getFitGapHistory(portfolioId);
        const historyData = res.data.history || [];
        setHistory(historyData);

        if (historyData.length > 0) {
          const currentMatch = historyData.find((h) => h.vacancy_id === Number(vacancyId));
          setSelectedSnapshot(currentMatch || historyData[0]);
        }
      } catch {
        // Graceful fallback if history fails to load
      }
    },
    [vacancyId],
  );

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      if (res.data.report) {
        setGenerating(false);
        await loadHistory(portfolio.id);
      }
    } catch (error) {
      const e = error as { response?: { status?: number } };
      if (e?.response?.status === 404) {
        try {
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          setGenerating(true);
        } catch {
          setGenerating(false);
        }
      }
    }
  }, [portfolio, vacancyId, loadHistory]);

  useEffect(() => {
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then(async (res) => {
        const data = res.data as { portfolio?: Portfolio };
        if (data.portfolio) {
          setPortfolio(data.portfolio);
          await loadHistory(data.portfolio.id);
        }
      })
      .finally(() => setLoading(false));
  }, [sessionId, loadHistory]);

  useEffect(() => {
    if (portfolio && history.length === 0 && !generating) {
      fetchReport();
    }
  }, [portfolio, history.length, generating, fetchReport]);

  usePolling(fetchReport, 5000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setSelectedSnapshot(null);
      setGenerating(true);
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio || !selectedSnapshot) return;
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        selectedSnapshot.vacancy_id,
      );
      const ext = format;
      const blob =
        format === "pdf"
          ? new Blob([res.data as BlobPart], { type: "application/pdf" })
          : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitgap-${sessionId}-${selectedSnapshot.vacancy_id}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto flex gap-6 items-start">
        <Skeleton className="w-64 h-[70vh] shrink-0" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto flex gap-6 items-start">
      {/* Historical Ledger Snapshot Sidebar */}
      <FitGapHistorySidebar
        history={history}
        activeSnapshotId={selectedSnapshot?.id ?? null}
        onSelectSnapshot={(snapshot: FitGapSnapshot) => setSelectedSnapshot(snapshot)}
      />

      {/* Main Analysis Container */}
      <div className="flex-1 space-y-6">
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
              <h1 className="text-lg font-semibold">
                Fit/Gap Report {selectedSnapshot && `— ${selectedSnapshot.vacancy_title}`}
              </h1>
            </div>
          </div>

          {portfolio && (
            <div className="flex gap-2">
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
              {selectedSnapshot && (
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

        {/* Generating Animation State */}
        {generating && (
          <div className="border rounded-lg p-12 text-center space-y-3 bg-white">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Generating fit/gap report...</p>
          </div>
        )}

        {/* Active Ledger Snapshot Rendering */}
        {selectedSnapshot && !generating && (
          <>
            {/* Skill comparison matrix */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Skill Comparison</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ComparisonTable comparisons={selectedSnapshot.skill_comparisons} />
              </CardContent>
            </Card>

            <Separator />

            {/* Culture & competency analysis block */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Culture &amp; Competency Fit</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {selectedSnapshot.culture_narrative || selectedSnapshot.overall_narrative}
                </p>
              </CardContent>
            </Card>

            {/* Unprompted Discovered Skills */}
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
                        <div key={s.id} className="text-sm flex items-center gap-2">
                          <span className="font-medium">{s.skill_label}</span>
                          <span className="text-muted-foreground">
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

        {!selectedSnapshot && !generating && (
          <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground bg-white">
            No historical fit/gap analysis reports found for this candidate session.
          </div>
        )}
      </div>
    </div>
  );
}
