import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { usePolling } from "@/hooks/usePolling";
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap,
  Building2,
  FileCheck2,
  AlertCircle
} from "lucide-react";
import type { FitGapReport, Portfolio, Vacancy } from "@/types";
import HeroBanner from "@/components/common/HeroBanner";
import RakaminSpinner from "@/components/common/RakaminSpinner";
import { downloadFile } from "@/utils/fileUtils";

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{
    id: string;
    sessionId: string;
    vacancyId: string;
  }>();

  const [report, setReport] = useState<FitGapReport | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
      setFetchError(null);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        try {
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          setGenerating(true);
          setFetchError(null);
        } catch {
          setGenerating(false);
          setFetchError("Unable to trigger fit/gap analysis. Please try again.");
        }
      } else {
        setFetchError("Failed to load fit/gap report.");
      }
    }
  }, [portfolio, vacancyId]);

  useEffect(() => {
    Promise.all([
      sessionsApi.getPortfolio(Number(sessionId)),
      vacanciesApi.get(Number(vacancyId)).catch(() => null)
    ])
      .then(([pRes, vRes]) => {
        const data = pRes.data as any;
        if (data.portfolio) {
          setPortfolio(data.portfolio);
        }
        if (vRes?.data?.vacancy) {
          setVacancy(vRes.data.vacancy);
        }
      })
      .catch(() => {
        setFetchError("Unable to load session portfolio.");
      })
      .finally(() => setLoading(false));
  }, [sessionId, vacancyId]);

  useEffect(() => {
    if (portfolio) fetchReport();
  }, [portfolio, fetchReport]);

  usePolling(fetchReport, 4000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    setFetchError(null);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      setGenerating(true);
    } catch (err: any) {
      setFetchError(err?.response?.data?.errors?.[0]?.message || "Regeneration request failed.");
    } finally {
      setRegenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setFetchError(null);
    try {
      const res = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
      const mime = format === "pdf" ? "application/pdf" : "application/json";
      downloadFile(res.data, `fitgap-session-${sessionId}-vacancy-${vacancyId}.${format}`, mime);
    } catch (err: any) {
      console.error("Export error:", err);
      setFetchError(
        err?.response?.data?.errors?.[0]?.message ||
          `Gagal mengunduh berkas ${format.toUpperCase()}. Pastikan analisis fit/gap sudah selesai.`
      );
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <RakaminSpinner text="Menghitung analisis fit/gap multi-model AI..." size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-2 pb-12">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
              className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Back to Candidate Portfolio"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-[#01959f]" />
              Detail Laporan Fit/Gap
            </h2>
          </div>
          {vacancy && (
            <p className="text-sm text-slate-500 flex items-center gap-1.5 ml-6">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              Role Benchmark: <span className="font-semibold text-slate-800">{vacancy.role_title}</span>
            </p>
          )}
        </div>

        {portfolio && (
          <div className="grid grid-cols-3 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating || generating}
              className="text-xs rounded-xl w-full sm:w-auto h-9 px-2 sm:px-3.5 font-semibold whitespace-nowrap justify-center"
            >
              {regenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 shrink-0" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              )}
              Hitung Ulang
            </Button>
            {report && (
              <>
                <Button
                  variant="cta"
                  size="sm"
                  onClick={() => handleExport("pdf")}
                  disabled={!!exporting}
                  className="text-xs rounded-xl shadow-xs w-full sm:w-auto h-9 px-2 sm:px-3.5 font-bold whitespace-nowrap justify-center"
                >
                  {exporting === "pdf" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 shrink-0" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                  )}
                  Export PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("json")}
                  disabled={!!exporting}
                  className="text-xs rounded-xl w-full sm:w-auto h-9 px-2 sm:px-3 font-semibold whitespace-nowrap justify-center"
                >
                  {exporting === "json" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 shrink-0" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                  )}
                  JSON
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Hero Banner */}
      <HeroBanner
        badgeText="⭐️ Multi-Model Fit/Gap Analysis"
        title={vacancy?.role_title ? `Fit/Gap Evaluation: ${vacancy.role_title}` : "Fit/Gap Assessment Report"}
        highlightText="Rakamin AI"
        subtitle="Komparasi terverifikasi antara capaian kompetensi kandidat terhadap ekspektasi rubric lowongan kerja."
        bulletPoints={[
          "Analisis delta level skill (Match, Exceed, Gap, Not Assessed)",
          "Narasi kesesuaian kultur (Culture Fit) terstruktur",
          "Human override audit trail & PDF export compliant",
        ]}
        imageSrc="/images/counseling.png"
        imageAlt="Rakamin Fit/Gap Evaluation"
        imageFloatingBadge={{
          title: "100% Objektif",
          subtitle: "Multi-model Validated",
        }}
      />

      {/* Error alert if any */}
      {fetchError && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Unable to process Fit/Gap report</p>
            <p className="text-xs mt-0.5">{fetchError}</p>
          </div>
        </div>
      )}

      {/* Generating / Background Worker In-Progress */}
      {generating && (
        <Card className="border-dashed border-2 bg-muted/10">
          <CardContent className="py-12 text-center space-y-4">
            <div className="relative mx-auto w-12 h-12 flex items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <Sparkles className="h-4 w-4 text-amber-500 absolute" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Synthesizing Fit/Gap Report...</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Comparing candidate portfolio competencies against vacancy benchmarks and generating culture narratives.
              </p>
            </div>
            <div className="text-xs text-muted-foreground animate-pulse">
              Polling background worker...
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Ready Content */}
      {report && (
        <div className="space-y-6">
          {/* Skill Comparison Table */}
          <Card className="shadow-xs">
            <CardHeader className="pb-3 border-b bg-muted/10">
              <CardTitle className="text-base font-semibold">Skill Comparison Matrix</CardTitle>
              <CardDescription className="text-xs">
                Rule-based delta mapping between vacancy requirements and assessed portfolio competencies.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <ComparisonTable comparisons={report.skill_comparisons} />
            </CardContent>
          </Card>

          {/* Hiring Recommendations & Culture Narratives */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="shadow-xs border-l-4 border-l-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Executive Recommendation
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {report.overall_narrative || "No specific hiring narrative generated."}
              </CardContent>
            </Card>

            <Card className="shadow-xs border-l-4 border-l-secondary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                  <Building2 className="h-4 w-4 text-secondary-foreground" />
                  Culture &amp; Competency Fit
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {report.culture_narrative || report.overall_narrative}
              </CardContent>
            </Card>
          </div>

          {/* Discovered Skills Section */}
          {portfolio && portfolio.skills.some((s) => s.is_discovered) && (
            <Card className="border-amber-200/80 bg-amber-50/20 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-900">
                  <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
                  Additive Discovered Competencies
                </CardTitle>
                <CardDescription className="text-xs text-amber-800/80">
                  Skills identified dynamically during conversational probing that were outside the baseline vacancy requirements.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-0">
                {portfolio.skills
                  .filter((s) => s.is_discovered)
                  .map((s) => (
                    <div
                      key={s.id}
                      className="p-2.5 rounded-md bg-background/80 border border-amber-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{s.skill_label}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                          {s.ai_level}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Confidence: <strong className="uppercase">{s.ai_confidence || "medium"}</strong> — Additive value
                      </span>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
