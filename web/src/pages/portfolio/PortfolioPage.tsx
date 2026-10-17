import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Zap,
  FileText,
  AlertCircle,
  Briefcase,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";
import HeroBanner from "@/components/common/HeroBanner";
import RakaminSpinner from "@/components/common/RakaminSpinner";
import { downloadFile } from "@/utils/fileUtils";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await sessionsApi.getPortfolio(Number(sessionId));
      const data = res.data as any;

      if (
        data.status === "generating" ||
        data.portfolio?.generation_status === "generating" ||
        data.portfolio?.generation_status === "pending"
      ) {
        setGenerating(true);
      } else if (data.portfolio) {
        setPortfolio(data.portfolio);
        setGenerating(false);

        // Build overrides map
        const overrideMap: Record<number, AssessorOverride> = {};
        (data.portfolio.overrides || []).forEach((o: AssessorOverride) => {
          overrideMap[o.portfolio_skill_id] = o;
        });
        setOverrides(overrideMap);
      }
    } catch (err: any) {
      console.error("Failed to fetch portfolio:", err);
      setGenerating(false);
      setLoadError(
        err?.response?.data?.errors?.[0]?.message ||
          "Gagal memuat portfolio hasil wawancara. Silakan coba lagi."
      );
    }
  }, [sessionId]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [, vRes, sRes] = await Promise.allSettled([
          fetchPortfolio(),
          vacanciesApi.list(),
          sessionsApi.get(Number(sessionId)),
        ]);

        if (vRes.status === "fulfilled" && vRes.value?.data?.vacancies) {
          const list = vRes.value.data.vacancies;
          setVacancies(list);
          if (list.length > 0) {
            setSelectedVacancy(String(list[0].id));
          }
        }

        if (sRes.status === "fulfilled" && sRes.value?.data?.session) {
          setCandidateName(sRes.value.data.session.candidate_name ?? null);
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [fetchPortfolio, sessionId]);

  // Poll while generating
  usePolling(fetchPortfolio, 4000, generating);

  const handleOverrideSaved = (skillId: number, override: AssessorOverride) => {
    setOverrides((prev) => ({ ...prev, [skillId]: override }));
  };

  const handleRunFitGap = () => {
    if (!selectedVacancy || !portfolio) return;
    navigate(`/assessments/${id}/sessions/${sessionId}/fitgap/${selectedVacancy}`);
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        selectedVacancy ? Number(selectedVacancy) : undefined
      );
      const mime = format === "json" ? "application/json" : "application/pdf";
      downloadFile(res.data, `portfolio-${sessionId}.${format}`, mime);
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-16">
        <RakaminSpinner text="Memuat portfolio hasil wawancara AI..." size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-2 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <Link
            to={`/assessments/${id}/invite`}
            className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Kembali ke Pengaturan Sesi"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Hasil Bukti Kompetensi
            </h2>
            {candidateName && (
              <p className="text-xs text-slate-500">
                Kandidat: <span className="font-semibold text-slate-700">{candidateName}</span>
              </p>
            )}
          </div>
        </div>

        <div className="w-full sm:w-auto flex flex-wrap sm:flex-nowrap items-center justify-center sm:justify-end gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="w-full sm:w-auto flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 text-xs border border-slate-200 rounded-xl px-3.5 py-2 sm:py-1.5 hover:bg-slate-50 transition-colors font-semibold text-slate-700 shadow-2xs whitespace-nowrap"
          >
            <FileText className="h-3.5 w-3.5 text-[#01959f] shrink-0" />
            Transkrip
          </Link>
          {!generating && portfolio && portfolio.generation_status === "complete" && (
            <>
              <Button
                variant="cta"
                size="sm"
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
                className="w-full sm:w-auto flex-1 sm:flex-initial rounded-xl text-xs shadow-xs font-bold h-9 px-3.5 whitespace-nowrap justify-center"
              >
                {exporting === "pdf" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1 shrink-0" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1 shrink-0" />
                )}
                Export PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
                disabled={!!exporting}
                className="w-full sm:w-auto flex-1 sm:flex-initial rounded-xl text-xs font-semibold h-9 px-3.5 whitespace-nowrap justify-center"
              >
                {exporting === "json" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1 shrink-0" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1 shrink-0" />
                )}
                JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Hero Banner */}
      <HeroBanner
        badgeText="⭐️ Candidate Competency Dossier"
        title={candidateName ? `Portfolio AI: ${candidateName}` : "Portfolio Hasil Wawancara AI"}
        highlightText="Rakamin B7"
        subtitle="Dossier bukti kompetensi teknis dari rekaman wawancara suara kandidat, dilengkapi level AI, kutipan verbatim, dan assessor override."
        bulletPoints={[
          "Analisis bukti transkrip verbatim per skill anchor B7",
          "Deteksi kompetensi tambahan (Discovered Skills)",
          "Dukungan Assessor Human Override sesuai standar UU PDP & Monozukuri",
        ]}
        imageSrc="/images/resume.png"
        imageAlt="Rakamin Competency Portfolio"
        imageFloatingBadge={{
          title: "Verbatim Evidence",
          subtitle: "Auditable Signals",
        }}
      />

      {/* Error alert if fetch failed */}
      {loadError && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Gagal memuat portfolio</p>
              <p className="text-xs mt-0.5">{loadError}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchPortfolio} className="rounded-xl text-xs shrink-0">
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Coba Lagi
          </Button>
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div className="border border-slate-200 rounded-3xl p-12 text-center space-y-4 bg-white shadow-xs">
          <Loader2 className="h-10 w-10 animate-spin text-[#01959f] mx-auto" />
          <div className="space-y-1">
            <p className="font-bold text-slate-800 text-base">Sedang Menganalisis Bukti Kompetensi...</p>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              AI sedang mengekstrak kutipan transkrip verbatim dan memetakan level skill B7. Proses ini memakan waktu ~10 detik.
            </p>
          </div>
        </div>
      )}

      {/* Failed state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <div className="border border-destructive/40 rounded-3xl p-8 text-center space-y-4 bg-rose-50/40 shadow-xs">
          <div className="space-y-1">
            <p className="font-bold text-destructive text-base">Pembuatan Portfolio Gagal</p>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              {portfolio.generation_error || "Terjadi kesalahan saat mengevaluasi transkrip percakapan."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl font-bold"
            onClick={async () => {
              await sessionsApi.regeneratePortfolio(Number(sessionId));
              setGenerating(true);
            }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Ulangi Pembuatan Portfolio
          </Button>
        </div>
      )}

      {/* Ready state */}
      {!generating && portfolio?.generation_status === "complete" && (
        <div className="space-y-8">
          {/* Configured skills */}
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Configured Skills
                </h3>
                <p className="text-xs text-slate-500">
                  Kompetensi teknis utama yang disyaratkan dalam kurikulum asesmen
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full shrink-0 whitespace-nowrap shadow-2xs">
                {portfolio.skills.filter((s) => !s.is_discovered).length} Skill
              </span>
            </div>

            <div className="space-y-3">
              {portfolio.skills
                .filter((s) => !s.is_discovered)
                .map((skill) => (
                  <SkillPortfolioCard
                    key={skill.id}
                    skill={skill}
                    override={overrides[skill.id]}
                    onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                  />
                ))}
            </div>
          </div>

          {/* Discovered skills */}
          {portfolio.skills.some((s) => s.is_discovered) && (
            <div className="space-y-4 pt-2">
              <Separator />
              <div className="flex items-start justify-between gap-3 pt-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
                    Discovered Skills
                  </h3>
                  <p className="text-xs text-slate-500">
                    Keahlian tambahan yang terdeteksi secara otomatis dari percakapan kandidat
                  </p>
                </div>
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full shrink-0 whitespace-nowrap shadow-2xs">
                  {portfolio.skills.filter((s) => s.is_discovered).length} Skill Tambahan
                </span>
              </div>

              <div className="space-y-3">
                {portfolio.skills
                  .filter((s) => s.is_discovered)
                  .map((skill) => (
                    <SkillPortfolioCard
                      key={skill.id}
                      skill={skill}
                      override={overrides[skill.id]}
                      onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Fit/Gap Benchmarking Section */}
          <div className="rounded-3xl border border-teal-200/80 bg-gradient-to-br from-teal-50/60 via-white to-slate-50 p-6 sm:p-7 shadow-xs space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-200 text-[#01959f] flex items-center justify-center shrink-0">
                <Briefcase className="h-5 w-5" />
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Benchmarking ke Role Vacancy (Fit/Gap Analysis)
                  </h3>
                  <span className="self-start text-[11px] font-bold text-[#01959f] bg-teal-50 border border-teal-200 rounded-full px-2.5 py-0.5 whitespace-nowrap shrink-0 shadow-2xs">
                    Evaluasi Kelulusan
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                  Bandingkan capaian level kompetensi kandidat ini dengan ekspektasi rubric posisi lowongan kerja untuk menghasilkan laporan kesesuaian kultur dan rekomendasi perekrutan.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                <SelectTrigger className="w-full sm:w-72 rounded-xl bg-white border-slate-300 font-medium">
                  <SelectValue placeholder="Pilih posisi lowongan kerja..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {vacancies.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.role_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="cta"
                onClick={handleRunFitGap}
                disabled={!selectedVacancy}
                className="rounded-xl shadow-sm font-bold text-xs sm:text-sm px-6 py-2.5 flex items-center justify-center gap-2"
              >
                <span>Jalankan Fit/Gap Analysis</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
