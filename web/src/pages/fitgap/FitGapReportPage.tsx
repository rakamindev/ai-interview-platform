import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Zap,
  AlertTriangle,
  Info,
  FileWarning,
} from "lucide-react";
import type { FitGapReport, Portfolio } from "@/types";

/* ─── Loading Skeleton ──────────────────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      {/* Table skeleton */}
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-36" />
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>

      {/* Narrative skeleton */}
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-44" />
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Error State ───────────────────────────────────────────────────────── */

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive/60 mb-3" />
        <p className="text-sm font-medium text-destructive">
          Failed to load fit/gap report
        </p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[320px]">
          {message}
        </p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={onRetry}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Generating State ──────────────────────────────────────────────────── */

function GeneratingState() {
  return (
    <div className="border rounded-lg p-12 text-center space-y-3 animate-in fade-in duration-300">
      <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
      <p className="text-sm font-medium">Generating fit/gap report…</p>
      <p className="text-xs text-muted-foreground max-w-[300px] mx-auto">
        Analyzing skill comparisons and generating culture narrative. This
        usually takes 10–30 seconds.
      </p>
    </div>
  );
}

/* ─── Narrative Section ─────────────────────────────────────────────────── */

function NarrativeSection({
  title,
  content,
  fallbackNotice,
  icon: Icon,
}: {
  title: string;
  content?: string | null;
  fallbackNotice?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Icon className="h-4 w-4 text-primary/70" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {content ? (
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {content}
          </p>
        ) : (
          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50/80 border border-amber-200/50">
            <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              {fallbackNotice ??
                "This analysis is currently unavailable. It may appear after regenerating the report."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────────── */

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

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(
        portfolio.id,
        Number(vacancyId)
      );
      setReport(res.data.report);
      setGenerating(false);
      setError(null);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        try {
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          setGenerating(true);
          setError(null);
        } catch (triggerErr: any) {
          setGenerating(false);
          setError(
            triggerErr?.response?.data?.error ??
              "Failed to trigger report generation. Please try again."
          );
        }
      } else {
        setError(
          e?.response?.data?.error ??
            "An unexpected error occurred while loading the report."
        );
      }
    }
  }, [portfolio, vacancyId]);

  useEffect(() => {
    setError(null);
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then(async (res) => {
        const data = res.data as any;
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        } else {
          setError("Portfolio not found for this session.");
        }
      })
      .catch((e: any) => {
        setError(
          e?.response?.data?.error ?? "Failed to load portfolio data."
        );
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
    setError(null);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      setGenerating(true);
    } catch (e: any) {
      setError(
        e?.response?.data?.error ?? "Failed to regenerate. Please try again."
      );
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        Number(vacancyId)
      );
      const blob =
        format === "pdf"
          ? new Blob([res.data as BlobPart], { type: "application/pdf" })
          : new Blob([JSON.stringify(res.data, null, 2)], {
              type: "application/json",
            });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitgap-${sessionId}-${vacancyId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(`Failed to export as ${format.toUpperCase()}.`);
    } finally {
      setExporting(null);
    }
  };

  /* ── Loading ─────────────────────────────────────────────────────────── */

  if (loading) {
    return <LoadingSkeleton />;
  }

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-semibold">Fit/Gap Report</h1>
            {report && (
              <Badge variant="outline" className="text-[10px] font-normal">
                {report.skill_comparisons.length} skills compared
              </Badge>
            )}
          </div>
          {report?.generated_at && (
            <p className="text-xs text-muted-foreground pl-6">
              Generated{" "}
              {new Date(report.generated_at).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          )}
        </div>

        {portfolio && (
          <div className="flex gap-2 flex-shrink-0">
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

      {/* Error */}
      {error && <ErrorState message={error} onRetry={fetchReport} />}

      {/* Generating */}
      {generating && !report && <GeneratingState />}

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

          {/* Culture & competency — separate cards for N12 fix */}
          <NarrativeSection
            title="Culture & Competency Fit"
            content={report.culture_narrative}
            fallbackNotice="Culture analysis is unavailable — the AI model could not generate this narrative. The overall recommendation below is based on skill comparisons only."
            icon={Info}
          />

          <NarrativeSection
            title="Overall Hiring Recommendation"
            content={report.overall_narrative}
            fallbackNotice="Overall recommendation is unavailable. Try regenerating the report."
            icon={FileWarning}
          />

          {/* Discovered skills */}
          {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
            <>
              <Separator />
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Discovered Skills
                    <Badge
                      variant="outline"
                      className="text-[10px] font-normal ml-1"
                    >
                      Not in vacancy requirements
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {portfolio.skills
                    .filter((s) => s.is_discovered)
                    .map((s) => (
                      <div
                        key={s.id}
                        className="text-sm flex items-center gap-2 py-1"
                      >
                        <span className="font-medium">{s.skill_label}</span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-normal"
                        >
                          L{s.ai_level}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {s.ai_confidence === "low"
                            ? "low confidence"
                            : s.ai_confidence === "medium"
                              ? "moderate confidence"
                              : "confirmed"}
                        </span>
                        <span className="text-xs text-muted-foreground/60 hidden sm:inline">
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
