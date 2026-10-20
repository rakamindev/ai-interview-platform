import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { usePolling } from "@/hooks/usePolling";
import { showRequestError } from "@/lib/requestToast";
import { LEVEL_LABELS } from "@/utils/constants";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Download,
  FileJson,
  FileText,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import type { FitGapReport, Portfolio } from "@/types";

function SummaryMetric({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: number;
  icon: typeof CheckCircle2;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/70 p-4">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${className ?? "bg-muted text-muted-foreground"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const queuedRef = useRef(false);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;

    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      if ("report" in res.data) {
        queuedRef.current = false;
        setReport(res.data.report);
        setGenerating(false);
        setGenerationError(null);
      } else {
        setGenerating(true);
      }
    } catch (error: any) {
      if (error?.response?.status === 404) {
        if (queuedRef.current) {
          setGenerating(true);
          return;
        }

        queuedRef.current = true;
        try {
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          setGenerating(true);
        } catch (error) {
          queuedRef.current = false;
          setGenerating(false);
          setGenerationError("Couldn’t start the fit/gap report.");
          showRequestError(error, "Couldn’t start the fit/gap report.");
        }
        return;
      }

      setGenerating(false);
      setGenerationError("Couldn’t load the fit/gap report.");
      showRequestError(error, "Couldn’t load the fit/gap report.");
    }
  }, [portfolio, vacancyId]);

  useEffect(() => {
    sessionsApi
      .getPortfolio(Number(sessionId))
      .then(async (res) => {
        const data = res.data as any;
        if (data.portfolio) setPortfolio(data.portfolio);
      })
      .catch((error) => {
        setGenerationError("Couldn’t load the portfolio.");
        showRequestError(error, "Couldn’t load the portfolio.");
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (portfolio) fetchReport();
  }, [portfolio, fetchReport]);

  usePolling(fetchReport, 5000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio || regenerating || generating) return;
    setRegenerating(true);
    setGenerationError(null);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      queuedRef.current = true;
      setReport(null);
      setGenerating(true);
    } catch (error) {
      setGenerationError("Couldn’t start report regeneration.");
      showRequestError(error, "Couldn’t start report regeneration.");
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
    } catch (error) {
      showRequestError(error, `Couldn’t export ${format.toUpperCase()} report.`);
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  const comparisons = report?.skill_comparisons ?? [];
  const matchCount = comparisons.filter((comparison) => comparison.result === "match").length;
  const gapCount = comparisons.filter((comparison) => comparison.result === "gap").length;
  const exceedCount = comparisons.filter((comparison) => comparison.result === "exceed").length;
  const notAssessedCount = comparisons.filter((comparison) => comparison.result === "not_assessed").length;
  const discoveredSkills = portfolio?.skills.filter((skill) => skill.is_discovered) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
            aria-label="Back to portfolio"
            className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                <Target className="mr-1.5 h-3 w-3" />
                Fit/Gap analysis
              </Badge>
              {report && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  Report ready
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Fit/Gap Report</h1>
            <p className="mt-1 text-sm text-muted-foreground">Vacancy #{vacancyId} · Evidence-based role comparison</p>
          </div>
        </div>

        {portfolio && (
          <div className="flex flex-wrap items-center justify-center gap-2 md:justify-end">
            <Button variant="outline" className="h-10" onClick={handleRegenerate} disabled={regenerating || generating}>
              {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Regenerate
            </Button>
            {report && (
              <>
                <div className="hidden items-center gap-2 sm:flex">
                  <Button variant="outline" className="h-10" onClick={() => handleExport("pdf")} disabled={!!exporting}>
                    {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    PDF
                  </Button>
                  <Button variant="outline" className="h-10" onClick={() => handleExport("json")} disabled={!!exporting}>
                    {exporting === "json" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
                    JSON
                  </Button>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="sm:hidden" aria-label="More report actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => handleExport("pdf")}><Download className="mr-2 h-4 w-4" />Export PDF</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleExport("json")}><FileJson className="mr-2 h-4 w-4" />Export JSON</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        )}
      </div>

      {(generating || generationError) && (
        <div className={generationError ? "flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4" : "flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4"}>
          {generationError ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" /> : <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />}
          <div>
            <p className="font-medium">{generationError ? "Report generation failed" : "Generating fit/gap report"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {generationError ?? "The report will appear here when the AI analysis is ready."}
            </p>
          </div>
        </div>
      )}

      {report && (
        <>
          <section className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-5 shadow-sm sm:p-7">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Role alignment</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">Skills against vacancy requirements</h2>
              </div>
              <p className="text-sm text-muted-foreground">{report.generated_at ? `Generated ${new Date(report.generated_at).toLocaleDateString()}` : "Current report"}</p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryMetric label="Matches" value={matchCount} icon={CheckCircle2} className="bg-primary/10 text-primary" />
              <SummaryMetric label="Gaps" value={gapCount} icon={AlertCircle} className="bg-secondary/25 text-secondary-foreground" />
              <SummaryMetric label="Exceeds" value={exceedCount} icon={Sparkles} className="bg-blue-50 text-blue-700" />
              <SummaryMetric label="Not assessed" value={notAssessedCount} icon={FileText} className="bg-muted text-muted-foreground" />
            </div>
          </section>

          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/70 px-5 py-5 sm:px-7">
              <CardTitle className="flex items-center gap-2 text-xl">
                <BarChart3 className="h-5 w-5 text-primary" />
                Skill comparison
              </CardTitle>
              <p className="text-sm text-muted-foreground">Required level compared with the candidate’s assessed level.</p>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <ComparisonTable comparisons={comparisons} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/70 px-5 py-5 sm:px-7">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="h-5 w-5 text-primary" />
                Culture &amp; competency fit
              </CardTitle>
              <p className="text-sm text-muted-foreground">AI-generated interpretation of the candidate’s working fit for this role.</p>
            </CardHeader>
            <CardContent className="px-5 py-6 sm:px-7">
              <p className="whitespace-pre-wrap text-[15px] leading-8 text-foreground">
                {report.culture_narrative || report.overall_narrative}
              </p>
            </CardContent>
          </Card>

          {discoveredSkills.length > 0 && (
            <Card className="rounded-2xl border-border/80 shadow-sm">
              <CardHeader className="border-b border-border/70 px-5 py-5 sm:px-7">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary/25 text-secondary-foreground"><Zap className="h-4 w-4" /></span>
                  Discovered skills
                </CardTitle>
                <p className="text-sm text-muted-foreground">Relevant signals outside the vacancy’s configured requirements.</p>
              </CardHeader>
              <CardContent className="grid gap-3 p-5 sm:grid-cols-2 sm:p-7">
                {discoveredSkills.map((skill) => (
                  <div key={skill.id} className="rounded-xl border border-border/70 bg-muted/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">{skill.skill_label}</p>
                      <Badge variant="secondary">{LEVEL_LABELS[skill.ai_level] ?? `L${skill.ai_level}`}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {skill.ai_confidence?.toLowerCase() === "low" ? "Low confidence" : "Confirmed by interview evidence"}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
