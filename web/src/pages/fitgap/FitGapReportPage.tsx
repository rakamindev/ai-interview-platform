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
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, AlertTriangle } from "lucide-react";
import { LEVEL_LABELS } from "@/utils/constants";
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
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  // ── Fetch the fit/gap report once we have a portfolio ──────────────────────
  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
      setError(null);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) {
        // Report doesn't exist yet — trigger generation once
        if (!generating) {
          try {
            const triggerRes = await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
            // 202 = queued, report not ready yet — start polling
            setGenerating(true);
            setError(null);
          } catch (triggerErr: any) {
            const triggerStatus = triggerErr?.response?.status;
            setGenerating(false);
            if (triggerStatus === 422) {
              setError(
                "Portfolio is not ready for fit/gap analysis yet. " +
                (triggerErr?.response?.data?.errors?.[0]?.message ?? "Please wait for portfolio generation to complete.")
              );
            } else {
              setError(
                triggerErr?.response?.data?.errors?.[0]?.message ??
                "Could not trigger fit/gap generation."
              );
            }
          }
        }
      } else if (status === 422) {
        setError(
          "Portfolio is not ready (status: " +
          (portfolio.generation_status ?? "unknown") +
          "). Portfolio must be complete before running fit/gap analysis."
        );
      } else {
        setError(
          e?.response?.data?.errors?.[0]?.message ??
          "Failed to load fit/gap report."
        );
      }
    }
  }, [portfolio, vacancyId, generating]);

  // ── Load portfolio via session ─────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then((res) => {
        const data = res.data as any;
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        } else {
          setError("Portfolio not found for this session.");
        }
      })
      .catch(() => setError("Failed to load session portfolio."))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (portfolio) fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio]);

  // Poll every 5s while generating
  usePolling(fetchReport, 5000, generating && !!portfolio);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    setReport(null);
    setError(null);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setGenerating(true);
    } catch (e: any) {
      setError(
        e?.response?.data?.errors?.[0]?.message ??
        e?.response?.data?.error ??
        "Regeneration failed."
      );
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
    } finally {
      setExporting(null);
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────
  const discoveredSkills = portfolio?.skills.filter((s) => s.is_discovered) ?? [];

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-semibold">Fit / Gap Report</h1>
          </div>
        </div>

        {portfolio && (
          <div className="flex gap-2 flex-wrap justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating || generating}
            >
              {regenerating
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
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
                  {exporting === "pdf"
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Download className="h-3.5 w-3.5 mr-1" />}
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("json")}
                  disabled={!!exporting}
                >
                  {exporting === "json"
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Download className="h-3.5 w-3.5 mr-1" />}
                  JSON
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Error state ────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* ── Generating spinner ─────────────────────────────────────────────── */}
      {generating && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">
            Generating fit/gap report — this usually takes under 30 seconds…
          </p>
        </div>
      )}

      {/* ── Empty state (no error, not generating, no report) ─────────────── */}
      {!generating && !report && !error && portfolio && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            No report yet. Click <strong>Regenerate</strong> to create one.
          </p>
        </div>
      )}

      {/* ── Report ─────────────────────────────────────────────────────────── */}
      {report && (
        <>
          {/* Generated at + meta */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              {report.skill_comparisons.length} skill{report.skill_comparisons.length !== 1 ? "s" : ""} compared
            </span>
            {report.generated_at && (
              <span>Generated {new Date(report.generated_at).toLocaleString()}</span>
            )}
          </div>

          {/* Quick recommendation banner */}
          {(() => {
            const comps = report.skill_comparisons;
            const gaps = comps.filter((c) => c.result === "gap").length;
            const assessed = comps.filter((c) => c.result !== "not_assessed").length;
            const pct = assessed > 0 ? Math.round(((assessed - gaps) / assessed) * 100) : 0;
            const isStrong = gaps === 0 && assessed > 0;
            const isGapHeavy = assessed > 0 && gaps / assessed > 0.5;
            return (
              <div
                className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${isStrong ? "bg-green-50 border-green-200"
                  : isGapHeavy ? "bg-amber-50 border-amber-200"
                    : "bg-blue-50 border-blue-200"
                  }`}
              >
                <span className="text-xl mt-0.5">
                  {isStrong ? "✅" : isGapHeavy ? "⚠️" : "📊"}
                </span>
                <div>
                  <p className={`text-sm font-semibold ${isStrong ? "text-green-800" : isGapHeavy ? "text-amber-800" : "text-blue-800"}`}>
                    {isStrong
                      ? "No skill gaps"
                      : isGapHeavy
                        ? `${gaps} skill gap${gaps !== 1 ? "s" : ""} identified`
                        : `${pct}% skill alignment`}
                  </p>
                  <p className={`text-xs mt-0.5 ${isStrong ? "text-green-700" : isGapHeavy ? "text-amber-700" : "text-blue-700"}`}>
                    {isStrong
                      ? `Candidate meets all required skill levels for this role.`
                      : isGapHeavy
                        ? `The candidate is below the required level for ${gaps} assessed skill${gaps !== 1 ? "s" : ""}.`
                        : `${gaps} skill gap${gaps !== 1 ? "s" : ""} present — see the comparison table below for specifics.`}
                  </p>
                </div>
              </div>
            );
          })()}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Skill Comparison</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          <Separator />

          {/* Culture & competency narrative */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Overall Assessment</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              {report.culture_narrative ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Culture fit
                  </p>
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                    {report.culture_narrative}
                  </p>
                </div>
              ) : null}

              {report.overall_narrative ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Overall recommendation
                  </p>
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                    {report.overall_narrative}
                  </p>
                </div>
              ) : null}

              {!report.culture_narrative && !report.overall_narrative && (
                <p className="text-sm text-muted-foreground italic">
                  Narrative generation was skipped or failed. Skill comparison data is still valid above.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Discovered skills — skills the candidate showed that weren't in the vacancy */}
          {discoveredSkills.length > 0 && (
            <>
              <Separator />
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Discovered Skills
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      — not in vacancy requirements
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-2">
                    {discoveredSkills.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 text-sm py-1 border-b last:border-0"
                      >
                        <span className="font-medium min-w-0 truncate">{s.skill_label}</span>
                        <span className="text-muted-foreground shrink-0">
                          {LEVEL_LABELS[s.ai_level] ?? `L${s.ai_level}`}
                        </span>
                        <span className="text-muted-foreground text-xs shrink-0">
                          ({s.ai_confidence} confidence)
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto shrink-0">
                          Additive, not required
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
