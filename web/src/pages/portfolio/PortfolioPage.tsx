import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  AlertTriangle,
  Sparkles,
  Users,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    const data = res.data as any;
    if (data.status === "generating" || data.portfolio?.generation_status === "generating" || data.portfolio?.generation_status === "pending") {
      setGenerating(true);
    } else if (data.portfolio) {
      setPortfolio(data.portfolio);
      setGenerating(false);
      // Build overrides map
      const overrideMap: Record<number, AssessorOverride> = {};
      data.portfolio.overrides.forEach((o: AssessorOverride) => {
        overrideMap[o.portfolio_skill_id] = o;
      });
      setOverrides(overrideMap);
    }
  }, [sessionId]);

  useEffect(() => {
    Promise.all([fetchPortfolio(), vacanciesApi.list(), sessionsApi.get(Number(sessionId))])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data.vacancies);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  // Poll while generating
  usePolling(fetchPortfolio, 5000, generating);

  const handleOverrideSaved = (skillId: number, override: AssessorOverride) => {
    setOverrides((prev) => ({ ...prev, [skillId]: override }));
  };

  const handleRunFitGap = () => {
    if (!selectedVacancy || !portfolio) return;
    navigate(`/assessments/${id}/sessions/${sessionId}/fitgap/${selectedVacancy}`);
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio || portfolio.generation_status !== "complete") return;
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        selectedVacancy ? Number(selectedVacancy) : undefined
      );

      const safeCandidateName = (candidateName || "Candidate").replace(/[^a-zA-Z0-9_-]/g, "_");
      const fileName = `Portfolio-${safeCandidateName}-Session-${sessionId}.${format}`;

      if (format === "json") {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Direct download failed:", err);
      alert("Gagal mengunduh berkas. Pastikan data portofolio sudah siap.");
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64 rounded-xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  const isComplete = !generating && portfolio?.generation_status === "complete";
  const isFailed = !generating && portfolio?.generation_status === "failed";

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors shadow-2xs shrink-0 cursor-pointer"
            title="Kembali ke Halaman Sebelumnya"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Portfolio Results
              </h1>
              {candidateName && (
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-semibold px-2.5 py-0.5 text-xs">
                  {candidateName}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Evaluasi kompetensi skill, bukti transkrip audio, dan komparasi benchmark lowongan.
            </p>
          </div>
        </div>

        {/* Action buttons: Transcript, PDF, JSON */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-9 px-3 text-xs font-semibold border-slate-200 hover:bg-slate-50 text-slate-700"
          >
            <Link to={`/assessments/${id}/sessions/${sessionId}/transcript`}>
              <FileText className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
              <span>Transcript</span>
            </Link>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
            disabled={!isComplete || !!exporting}
            className="h-9 px-3 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title={!isComplete ? "Laporan belum selesai digenerate" : "Unduh Laporan PDF"}
          >
            {exporting === "pdf" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 text-primary" />
            ) : (
              <Download className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
            )}
            <span>{exporting === "pdf" ? "Unduh PDF..." : "Unduh PDF"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("json")}
            disabled={!isComplete || !!exporting}
            className="h-9 px-3 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title={!isComplete ? "Laporan belum selesai digenerate" : "Unduh Data JSON"}
          >
            {exporting === "json" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 text-primary" />
            ) : (
              <Download className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
            )}
            <span>{exporting === "json" ? "Unduh JSON..." : "Unduh JSON"}</span>
          </Button>
        </div>
      </div>

      {/* ── State 1: Generating in Background ── */}
      {generating && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-10 text-center space-y-4 shadow-2xs">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-base font-bold text-slate-900">AI Sedang Menganalisis Percakapan...</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Model AI sedang membaca seluruh rekaman transkrip dan memetakan skor kompetensi (L1–L5) beserta kutipan bukti jawaban kandidat. Proses ini membutuhkan waktu sekitar 1–2 menit.
            </p>
          </div>
        </div>
      )}

      {/* ── State 2: Failed / Insufficient Transcript State ── */}
      {isFailed && (
        <div className="bg-white rounded-3xl border border-amber-200/80 bg-amber-50/20 p-8 sm:p-10 text-center space-y-5 shadow-2xs">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200 shadow-xs">
            <AlertTriangle className="h-7 w-7" />
          </div>
          
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-lg font-bold text-slate-900">
              Laporan Portofolio Belum Tersedia
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sesi wawancara ini tidak memiliki rekaman transkrip audio yang cukup (sesi terputus lebih awal atau belum ada respon jawaban yang terekam), sehingga AI belum dapat menghasilkan penilaian kompetensi.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await sessionsApi.regeneratePortfolio(Number(sessionId));
                setGenerating(true);
              }}
              className="rounded-xl border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 font-semibold text-xs h-9 px-4"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5 text-amber-700" />
              <span>Coba Generate Ulang</span>
            </Button>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl border-slate-200 text-slate-700 font-semibold text-xs h-9 px-4 hover:bg-slate-50"
            >
              <Link to={`/assessments/${id}/sessions/${sessionId}/transcript`}>
                <FileText className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                <span>Periksa Transkrip Sesi</span>
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* ── State 3: Ready / Complete State ── */}
      {isComplete && (
        <div className="space-y-6">
          {/* Configured Skills Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Configured Skills
              </h2>
              <span className="text-xs text-muted-foreground">
                {portfolio.skills.filter((s) => !s.is_discovered).length} Skill dinilai
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

          {/* Discovered Skills Section */}
          {portfolio.skills.some((s) => s.is_discovered) && (
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Discovered Skills
                </h2>
                <p className="text-xs text-muted-foreground">
                  Keahlian tambahan yang terungkap saat kandidat menjawab pertanyaan di luar konfigurasi awal.
                </p>
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

          <Separator />

          {/* Fit/Gap Benchmark Analysis Launcher Card */}
          <div className="bg-slate-50/90 rounded-2xl border border-slate-200/80 p-5 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Analisis Fit / Gap Benchmark</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bandingkan hasil skill kandidat ini dengan template lowongan (*Vacancy*) untuk melihat persentase kecocokan.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
              <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                <SelectTrigger className="w-full sm:w-64 bg-white rounded-xl text-xs font-medium border-slate-200">
                  <SelectValue placeholder="Pilih Template Lowongan Benchmark..." />
                </SelectTrigger>
                <SelectContent>
                  {vacancies.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)} className="text-xs">
                      {v.role_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={handleRunFitGap}
                disabled={!selectedVacancy}
                className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-xs sm:whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                <span>Jalankan Fit/Gap Report →</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
