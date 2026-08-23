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
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, AlertTriangle } from "lucide-react";
import { POLL_DEADLINE_MS } from "@/utils/constants";
import type { FitGapReport, Portfolio } from "@/types";
import { m } from "@/paraglide/messages.js";

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
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const pollStartRef = useRef<number>(0);
  const generationTriggeredRef = useRef(false);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
      setError(null);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        // Only trigger generation once — stop re-POSTing on every 404
        if (!generationTriggeredRef.current) {
          generationTriggeredRef.current = true;
          try {
            await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
            setGenerating(true);
            pollStartRef.current = Date.now();
          } catch {
            setGenerating(false);
            setError(m.fitgap_start_generation_error());
          }
        }
      } else if (status === 202) {
        // Report is generating — keep polling
        setGenerating(true);
      } else if (status != null && status >= 500) {
        setError(m.fitgap_server_error());
        setGenerating(false);
      }
    }
  }, [portfolio, vacancyId]);

  useEffect(() => {
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then(async (res) => {
        const data = res.data as { portfolio?: Portfolio };
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        }
        return;
      })
      .catch(() => {
        setError(m.fitgap_load_portfolio_error());
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (portfolio) fetchReport();
  }, [portfolio, fetchReport]);

  // Stop polling after deadline
  useEffect(() => {
    if (!generating) return;
    const timer = setTimeout(() => {
      setTimedOut(true);
      setGenerating(false);
    }, POLL_DEADLINE_MS);
    return () => clearTimeout(timer);
  }, [generating]);

  usePolling(fetchReport, 5000, generating && !!portfolio && !timedOut);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    setTimedOut(false);
    generationTriggeredRef.current = false;
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      setGenerating(true);
      pollStartRef.current = Date.now();
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
      const blob =
        format === "pdf"
          ? new Blob([res.data as BlobPart], { type: "application/pdf" })
          : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitgap-${sessionId}-${vacancyId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(m.fitgap_export_error());
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

  if (error && !report && !generating) {
    return (
      <main className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Back to portfolio"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">{m.fitgap_title()}</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setError(null);
                generationTriggeredRef.current = false;
                fetchReport();
              }}
            >
              {m.fitgap_retry()}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Back to portfolio"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-semibold tracking-tight">{m.fitgap_title()}</h1>
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
              {m.fitgap_regenerate()}
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
                  {m.fitgap_export_pdf()}
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
                  {m.fitgap_export_json()}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Generating */}
      {generating && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">{m.fitgap_generating()}</p>
          </CardContent>
        </Card>
      )}

      {/* Timed out */}
      {timedOut && !report && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
            <p className="text-sm text-muted-foreground">
              {m.fitgap_generating_slow()}
            </p>
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating}>
              {regenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
              )}
              {m.fitgap_retry()}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Report ready */}
      {report && (
        <>
          {/* Skill comparison */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{m.fitgap_skill_comparison()}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          <Separator />

          {/* Culture fit — separate section */}
          {report.culture_narrative && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{m.fitgap_culture_fit()}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {report.culture_narrative}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Overall recommendation — own section */}
          {report.overall_narrative && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{m.fitgap_hiring_recommendation()}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {report.overall_narrative}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Discovered skills */}
          {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
            <>
              <Separator />
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    {m.fitgap_discovered_skills_title()}
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
                            ? m.fitgap_low_confidence()
                            : m.fitgap_confirmed()}
                          )
                        </span>
                        <span className="text-xs text-muted-foreground">
                          — {m.fitgap_discovered_not_required()}
                        </span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </main>
  );
}
