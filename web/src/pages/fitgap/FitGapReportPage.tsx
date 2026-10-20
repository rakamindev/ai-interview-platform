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
import { LEVEL_LABELS, parseLevel } from "@/utils/constants";
import type { FitGapReport, Portfolio, PortfolioSkill } from "@/types";

// Generation normally takes seconds. Past this, stop the spinner and say so (AC-26).
export const FITGAP_TIMEOUT_MS = 2 * 60_000;

type Problem = "portfolio" | "report" | "timeout";

const PROBLEM_TEXT: Record<Problem, { title: string; detail: string }> = {
  portfolio: { title: "Couldn't load the portfolio for this report.", detail: "Check your connection, then try again." },
  report: { title: "Couldn't load the fit/gap report.", detail: "Check your connection, then try again." },
  timeout: {
    title: "This is taking longer than expected.",
    detail: "The report may still be generating. Try again in a moment.",
  },
};

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
  const [problem, setProblem] = useState<Problem | null>(null);
  // Ask the API to generate at most once per visit: polling used to re-trigger on every 404, and the
  // duplicate jobs raced each other (P1-6). "Try again" and "Regenerate" are the only ways to ask again.
  const triggered = useRef(false);
  const startedAt = useRef<number | null>(null);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
      startedAt.current = null;
    } catch (e: any) {
      if (e?.response?.status !== 404) {
        setGenerating(false);
        setProblem("report");
        return;
      }
      if (!triggered.current) {
        triggered.current = true;
        try {
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          startedAt.current = Date.now();
          setGenerating(true);
        } catch {
          setGenerating(false);
          setProblem("report");
        }
        return;
      }
      if (startedAt.current !== null && Date.now() - startedAt.current > FITGAP_TIMEOUT_MS) {
        setGenerating(false);
        setProblem("timeout");
      }
    }
  }, [portfolio, vacancyId]);

  const loadPortfolio = useCallback(() => {
    setLoading(true);
    setProblem(null);
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then((res) => {
        const data = res.data as any;
        if (data.portfolio) setPortfolio(data.portfolio);
        else setProblem("portfolio");
      })
      .catch(() => setProblem("portfolio"))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  useEffect(() => {
    if (portfolio) fetchReport();
  }, [portfolio, fetchReport]);

  usePolling(fetchReport, 5000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      triggered.current = true;
      startedAt.current = Date.now();
      setProblem(null);
      setReport(null);
      setGenerating(true);
    } catch {
      setProblem("report");
    } finally {
      setRegenerating(false);
    }
  };

  const handleTryAgain = () => {
    if (!portfolio) {
      loadPortfolio();
      return;
    }
    setProblem(null);
    triggered.current = false;
    startedAt.current = null;
    fetchReport();
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header: the actions wrap under the title on a phone (AC-29) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Back to the portfolio"
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

      {/* Something went wrong: say what, and offer a way out instead of an endless spinner (AC-26) */}
      {problem && (
        <div role="alert" className="border border-destructive/40 rounded-lg p-6 text-center space-y-3">
          <div>
            <p className="font-medium">{PROBLEM_TEXT[problem].title}</p>
            <p className="text-sm text-muted-foreground mt-1">{PROBLEM_TEXT[problem].detail}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleTryAgain}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try again
          </Button>
        </div>
      )}

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
                      <div key={s.id} className="text-sm flex flex-wrap items-center gap-x-2">
                        <span className="font-medium">{s.skill_label}</span>
                        <span className="text-muted-foreground">
                          {discoveredLevel(s)}
                        </span>
                        <span className="text-xs text-muted-foreground">— Not required for this role, may be additive.</span>
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

/** "L2 (low confidence)", or "not assessed" when the AI gave no readable level. */
function discoveredLevel(skill: PortfolioSkill): string {
  const level = parseLevel(skill.ai_level);
  if (level === null) return "not assessed";
  return `${LEVEL_LABELS[level]} (${skill.ai_confidence?.toLowerCase() === "low" ? "low confidence" : "confirmed"})`;
}
