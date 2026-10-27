import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import SkillRadarChart from "@/components/fitgap/SkillRadarChart";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { usePolling } from "@/hooks/usePolling";
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Zap,
  Award,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Briefcase
} from "lucide-react";
import type { FitGapReport, Portfolio, Vacancy } from "@/types";

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
  const [candidateName, setCandidateName] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!portfolio) return;
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyId));
      setReport(res.data.report);
      setGenerating(false);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        try {
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyId));
          setGenerating(true);
        } catch {
          setGenerating(false);
        }
      }
    }
  }, [portfolio, vacancyId]);

  useEffect(() => {
    Promise.all([
      sessionsApi.getPortfolio(Number(sessionId)),
      sessionsApi.get(Number(sessionId)),
      vacanciesApi.get(Number(vacancyId)),
    ])
      .then(([pRes, sRes, vRes]) => {
        const pData = pRes.data as any;
        if (pData.portfolio) setPortfolio(pData.portfolio);
        setCandidateName(sRes.data.session.candidate_name ?? null);
        setVacancy(vRes.data.vacancy);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId, vacancyId]);

  useEffect(() => {
    if (portfolio) fetchReport();
  }, [portfolio, fetchReport]);

  usePolling(fetchReport, 4000, generating && !!portfolio);

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setRegenerating(true);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      setReport(null);
      setGenerating(true);
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
      const ext = format;
      const blob =
        format === "pdf"
          ? new Blob([res.data as BlobPart], { type: "application/pdf" })
          : new Blob([JSON.stringify(res.data, null, 2)], {
              type: "application/json",
            });
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
      <div className="max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-44 w-full rounded-3xl" />
        <Skeleton className="h-80 w-full rounded-3xl" />
      </div>
    );
  }

  // Calculate Match Stats
  const comparisons = report?.skill_comparisons || [];
  const matchCount = comparisons.filter((c) => c.result === "match").length;
  const gapCount = comparisons.filter((c) => c.result === "gap").length;
  const matchRate = comparisons.length > 0 ? Math.round((matchCount / comparisons.length) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <Link
          to={`/assessments/${id}/sessions/${sessionId}/portfolio`}
          className="hover:text-teal-700 flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Kembali ke Portfolio</span>
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-semibold">Laporan Analisis Fit/Gap</span>
      </div>

      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5 text-teal-700" /> {vacancy?.role_title || "Target Role"}
              </span>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" /> Evaluated by Gemini 3.1 Pro
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Analisis Kesesuaian: {candidateName || "Kandidat"}
            </h1>
            <p className="text-sm text-slate-500">
              Evaluasi komparatif antara kompetensi kandidat dengan ekspektasi jabatan lowongan.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating || generating}
              className="rounded-xl border-slate-200 text-xs h-9 bg-white shadow-2xs font-medium"
            >
              {regenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
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
                  className="rounded-xl border-slate-200 text-xs h-9 bg-white shadow-2xs font-medium"
                >
                  {exporting === "pdf" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                  )}
                  Export PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("json")}
                  disabled={!!exporting}
                  className="rounded-xl border-slate-200 text-xs h-9 bg-white shadow-2xs font-medium"
                >
                  {exporting === "json" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                  )}
                  JSON
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Fit/Gap Score Overview KPI Cards */}
        {report && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
            <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/60">
              <div className="text-[11px] font-medium text-slate-500">Skor Kesesuaian</div>
              <div className="text-xl font-bold text-teal-700">{matchRate}% Match</div>
            </div>
            <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/60">
              <div className="text-[11px] font-medium text-emerald-800">Kompetensi Memenuhi</div>
              <div className="text-xl font-bold text-emerald-700">{matchCount} Skills</div>
            </div>
            <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/60">
              <div className="text-[11px] font-medium text-amber-800">Perlu Pengembangan</div>
              <div className="text-xl font-bold text-amber-700">{gapCount} Skills Gap</div>
            </div>
            <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/60">
              <div className="text-[11px] font-medium text-slate-500">Rekomendasi</div>
              <div className="text-xs font-bold text-slate-800 mt-1 flex items-center gap-1">
                {matchRate >= 70 ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Recommended
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Conditional
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Generating State */}
      {generating && (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
          <Loader2 className="h-10 w-10 animate-spin text-teal-700 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-bold text-base text-slate-900">
              Menghitung Analisis Fit/Gap...
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Membandingkan bukti interview dan level kandidat dengan matriks ekspektasi lowongan {vacancy?.role_title}.
            </p>
          </div>
        </div>
      )}

      {/* Report Content Ready */}
      {report && (
        <div className="space-y-6">
          {/* Visual Interactive Competency Spider/Radar Chart */}
          {comparisons.length > 0 && (
            <SkillRadarChart comparisons={comparisons} />
          )}

          {/* Comparison Table Card */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Tabulasi Skor &amp; Bukti Evaluasi
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rincian level target lowongan versus pencapaian kandidat beserta bukti kutipan transkrip.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {comparisons.length} Evaluated
              </span>
            </div>
            <div className="p-6">
              <ComparisonTable comparisons={comparisons} />
            </div>
          </div>

          {/* Culture & Competency Narrative Card */}
          {(report.culture_narrative || report.overall_narrative) && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-teal-700" />
                <h3 className="font-bold text-base text-slate-900">
                  Sintesis Budaya &amp; Evaluasi Kompetensi Menyeluruh
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap bg-slate-50/80 p-5 rounded-2xl border border-slate-200/70 font-sans">
                {report.culture_narrative || report.overall_narrative}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
