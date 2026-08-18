import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Download,
  FileWarning,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { usePolling } from "@/hooks/usePolling";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import type { FitGapReport, Portfolio } from "@/types";

interface ApiErrorShape {
  response?: {
    status?: number;
    data?: {
      error?: string;
      message?: string;
      errors?: Array<{ message?: string }>;
    };
  };
}

function errorMessage(error: unknown, fallback: string) {
  const shaped = error as ApiErrorShape;
  return shaped.response?.data?.error ?? shaped.response?.data?.message ?? shaped.response?.data?.errors?.[0]?.message ?? fallback;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function StatePanel({
  icon,
  title,
  description,
  action,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  tone?: "neutral" | "warning" | "danger";
}) {
  const styles = {
    neutral: "border-slate-200 bg-white",
    warning: "border-amber-200 bg-amber-50/70",
    danger: "border-rose-200 bg-rose-50/70",
  };

  return (
    <Card className={styles[tone]}>
      <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        {icon}
        <div className="max-w-lg space-y-1">
          <h2 className="font-semibold text-slate-950">{title}</h2>
          <p className="text-sm leading-relaxed text-slate-600">{description}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

function isNotFound(error: unknown) {
  return (error as ApiErrorShape).response?.status === 404;
}

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();
  const numericSessionId = Number(sessionId);
  const numericVacancyId = Number(vacancyId);
  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [portfolioGenerating, setPortfolioGenerating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const triggerAttempted = useRef(false);

  const fetchPortfolio = useCallback(async () => {
    try {
      const response = await sessionsApi.getPortfolio(numericSessionId);
      const data = response.data as { portfolio?: Portfolio; status?: string };
      const nextPortfolio = data.portfolio ?? null;
      const waiting =
        data.status === "pending" ||
        data.status === "generating" ||
        nextPortfolio?.generation_status === "pending" ||
        nextPortfolio?.generation_status === "generating";

      setPortfolio(nextPortfolio);
      setPortfolioGenerating(waiting);
      if (waiting || nextPortfolio) {
        setLoadError(null);
      } else {
        setLoadError("Portfolio belum tersedia untuk Fit/Gap analysis.");
      }
    } catch (error) {
      setPortfolioGenerating(false);
      setLoadError(errorMessage(error, "Portfolio belum dapat dimuat."));
    }
  }, [numericSessionId]);

  const applyReport = useCallback((nextReport: FitGapReport) => {
    setReport(nextReport);
    setGenerating(nextReport.generation_status === "pending" || nextReport.generation_status === "generating");
    if (nextReport.generation_status !== "failed") setLoadError(null);
  }, []);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;

    try {
      const response = await portfoliosApi.getFitGap(portfolio.id, numericVacancyId);
      applyReport(response.data.report);
    } catch (error) {
      if (isNotFound(error) && !triggerAttempted.current) {
        triggerAttempted.current = true;
        try {
          const response = await portfoliosApi.triggerFitGap(portfolio.id, numericVacancyId);
          if ("report" in response.data) {
            applyReport(response.data.report);
          } else {
            setGenerating(true);
          }
          setLoadError(null);
        } catch (triggerError) {
          setGenerating(false);
          setLoadError(errorMessage(triggerError, "Fit/Gap generation belum dapat dimulai."));
        }
      } else if (isNotFound(error)) {
        setGenerating(false);
        setLoadError("Fit/Gap report tidak ditemukan setelah generation dimulai.");
      } else {
        setGenerating(false);
        setLoadError(errorMessage(error, "Fit/Gap report belum dapat dimuat."));
      }
    }
  }, [applyReport, numericVacancyId, portfolio]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchPortfolio().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [fetchPortfolio]);

  useEffect(() => {
    if (portfolio) void fetchReport();
  }, [fetchReport, portfolio]);

  usePolling(fetchPortfolio, 5000, portfolioGenerating);
  usePolling(fetchReport, 5000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    setGenerating(true);
    setLoadError(null);
    try {
      const response = await portfoliosApi.regenerateFitGap(portfolio.id, numericVacancyId);
      if ("report" in response.data) applyReport(response.data.report);
      else setReport(null);
      await fetchReport();
    } catch (error) {
      setGenerating(false);
      setLoadError(errorMessage(error, "Fit/Gap generation belum dapat dijalankan ulang."));
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setLoadError(null);
    try {
      const response = await portfoliosApi.exportPortfolio(portfolio.id, format, numericVacancyId);
      const blob =
        format === "pdf"
          ? new Blob([response.data as BlobPart], { type: "application/pdf" })
          : new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
      downloadBlob(blob, `fitgap-${sessionId}-${vacancyId}.${format}`);
    } catch (error) {
      setLoadError(errorMessage(error, "Export Fit/Gap gagal dibuat."));
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const reportFailed = report?.generation_status === "failed";
  const reportReady = report?.generation_status === "complete";

  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              aria-label="Back to portfolio"
              className="mt-1 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Decision support
              </div>
              <h1 className="break-words text-2xl font-bold tracking-tight text-slate-950">Fit / Gap report</h1>
              <p className="mt-1 text-sm text-slate-500">Skill comparison with explicit evidence state and human overrides.</p>
            </div>
          </div>
          {portfolio && (
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button variant="outline" size="sm" onClick={() => void handleRegenerate()} disabled={regenerating || generating}>
                {regenerating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                Regenerate
              </Button>
              {reportReady && (
                <>
                  <Button variant="outline" size="sm" onClick={() => void handleExport("pdf")} disabled={!!exporting}>
                    {exporting === "pdf" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                    PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void handleExport("json")} disabled={!!exporting}>
                    {exporting === "json" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                    JSON
                  </Button>
                </>
              )}
            </div>
          )}
        </header>

        {loadError && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{loadError}</span>
          </div>
        )}

        {!portfolio && portfolioGenerating && !loadError && (
          <StatePanel
            icon={<Loader2 className="h-9 w-9 animate-spin text-indigo-600" aria-hidden="true" />}
            title="Waiting for portfolio"
            description="Transcript analysis belum selesai. Halaman ini akan mengambil portfolio kembali dan memulai Fit/Gap setelah hasilnya siap."
          />
        )}

        {!portfolio && !portfolioGenerating && !loadError && (
          <StatePanel
            icon={<FileWarning className="h-9 w-9 text-amber-600" aria-hidden="true" />}
            title="Portfolio belum siap"
            description="Fit/Gap analysis membutuhkan portfolio yang sudah selesai dibuat dari transcript."
            tone="warning"
            action={<Link to={`/assessments/${id}/sessions/${sessionId}/portfolio`}><Button>Back to portfolio</Button></Link>}
          />
        )}

        {generating && (
          <StatePanel
            icon={<Loader2 className="h-9 w-9 animate-spin text-indigo-600" aria-hidden="true" />}
            title="Generating Fit / Gap report"
            description="Requirement dan candidate signal sedang dibandingkan. Polling hanya membaca report yang sama; job baru tidak dibuat pada setiap refresh."
          />
        )}

        {!generating && reportFailed && (
          <StatePanel
            icon={<FileWarning className="h-9 w-9 text-rose-600" aria-hidden="true" />}
            title="Fit / Gap generation failed"
            description={report?.generation_error || "Report gagal dibuat dan tidak menampilkan kesimpulan parsial."}
            tone="danger"
            action={<Button onClick={() => void handleRegenerate()} disabled={regenerating}><RefreshCw className="mr-2 h-4 w-4" />Try again</Button>}
          />
        )}

        {!generating && reportReady && report && portfolio && (
          <>
            <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
              <CardContent className="flex items-start gap-3 px-5 py-5 sm:px-6">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-slate-950">Review the comparison, then read the narrative</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    Not assessed berarti evidence belum cukup, bukan automatic gap. Override manusia ditandai eksplisit di tabel.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg text-slate-950">Skill comparison</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-5 sm:px-6">
                <ComparisonTable comparisons={report.skill_comparisons ?? []} />
              </CardContent>
            </Card>

            <Separator />

            <section className="grid gap-4 lg:grid-cols-2" aria-label="Narrative assessment">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-950">Culture fit</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
                    {report.culture_narrative || "Belum ada culture narrative."}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-950">Overall recommendation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
                    {report.overall_narrative || "Belum ada overall narrative."}
                  </p>
                </CardContent>
              </Card>
            </section>

            {portfolio.skills.some((skill) => skill.is_discovered) && (
              <>
                <Separator />
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg text-slate-950">
                      <Zap className="h-5 w-5 text-amber-500" aria-hidden="true" />
                      Discovered skills
                    </CardTitle>
                    <p className="text-sm text-slate-600">Signal tambahan yang tidak menjadi requirement role ini.</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {portfolio.skills
                      .filter((skill) => skill.is_discovered)
                      .map((skill) => (
                        <div key={skill.id} className="flex flex-col gap-1 rounded-xl border border-amber-200 bg-white/70 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <span className="font-medium text-slate-900">{skill.skill_label}</span>
                          <span className="text-sm text-slate-500">
                            {skill.rating_status === "not_assessed" ? "Not assessed" : `L${skill.ai_level}`} · {skill.ai_confidence || "confidence unknown"}
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
    </main>
  );
}
