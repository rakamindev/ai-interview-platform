import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  Award,
  Sparkles,
  Briefcase,
  ChevronRight,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import SkillRadarChart from "@/components/fitgap/SkillRadarChart";
import { parseLevel } from "@/utils/constants";
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
  const [roleTitle, setRoleTitle] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
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
      const overrideMap: Record<number, AssessorOverride> = {};
      data.portfolio.overrides?.forEach((o: AssessorOverride) => {
        overrideMap[o.portfolio_skill_id] = o;
      });
      setOverrides(overrideMap);
    }
  }, [sessionId]);

  useEffect(() => {
    Promise.all([
      fetchPortfolio(),
      vacanciesApi.list(),
      sessionsApi.get(Number(sessionId)),
    ])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data.vacancies || []);
        setCandidateName(sRes.data.session.candidate_name ?? null);
        setRoleTitle(sRes.data.session.assessment?.name ?? null);
        if (vRes.data.vacancies?.length > 0) {
          setSelectedVacancy(String(vRes.data.vacancies[0].id));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

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
      if (format === "json") {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-${sessionId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-${sessionId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
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

  const configuredSkills = portfolio?.skills.filter((s) => !s.is_discovered) || [];
  const discoveredSkills = portfolio?.skills.filter((s) => s.is_discovered) || [];
  const totalOverrides = Object.keys(overrides).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <Link to={`/assessments/${id}/invite`} className="hover:text-teal-700 flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Kembali ke Sesi Assessment</span>
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-semibold">Laporan Portfolio Evaluasi</span>
      </div>

      {/* Executive Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Award className="h-3.5 w-3.5 text-teal-700" /> B7 Skill Verification
              </span>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" /> Evaluated by Gemini 3.1 Pro
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {candidateName || "Kandidat Terverifikasi"}
            </h1>
            <p className="text-sm text-slate-500">
              Hasil wawancara teknis untuk posisi <strong>{roleTitle || "Technical Role"}</strong>
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/transcript`}
              className="inline-flex items-center gap-1.5 text-xs font-medium border border-slate-200 rounded-xl px-3 h-9 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs"
            >
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              Transkrip
            </Link>

            {!generating && portfolio && (
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

        {/* Quick KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
          <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/60">
            <div className="text-[11px] font-medium text-slate-500">Target Kompetensi</div>
            <div className="text-lg font-bold text-slate-900">{configuredSkills.length} Skills</div>
          </div>
          <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/60">
            <div className="text-[11px] font-medium text-slate-500">Discovered Skills</div>
            <div className="text-lg font-bold text-amber-600">+{discoveredSkills.length} Probed</div>
          </div>
          <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/60">
            <div className="text-[11px] font-medium text-slate-500">Assessor Overrides</div>
            <div className="text-lg font-bold text-teal-700">{totalOverrides} Manual</div>
          </div>
          <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/60">
            <div className="text-[11px] font-medium text-slate-500">Status Evaluasi</div>
            <div className="text-xs font-bold text-emerald-700 flex items-center gap-1 mt-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Terverifikasi
            </div>
          </div>
        </div>
      </div>

      {/* Generating State */}
      {generating && (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
          <Loader2 className="h-10 w-10 animate-spin text-teal-700 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-bold text-base text-slate-900">
              Menyusun Portfolio &amp; Analisis Kompetensi...
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Gemini 3.1 Pro sedang mengevaluasi transkrip, memvalidasi bukti jawaban teknis, dan menentukan level kompetensi.
            </p>
          </div>
        </div>
      )}

      {/* Failed State */}
      {!generating && portfolio?.generation_status === "failed" && (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-6 text-center space-y-3">
          <p className="text-sm font-semibold text-red-700">
            Gagal menghasilkan evaluasi portfolio: {portfolio.generation_error || "Terjadi kendala pada API."}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await sessionsApi.regeneratePortfolio(Number(sessionId));
              setGenerating(true);
            }}
            className="rounded-xl border-red-300 text-red-700 bg-white"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Coba Generate Ulang
          </Button>
        </div>
      )}

      {/* Complete State */}
      {!generating && portfolio?.generation_status === "complete" && (
        <>
          {/* Visual Competency Radar Map */}
          {portfolio.skills.length >= 2 && (
            <SkillRadarChart
              comparisons={portfolio.skills.map((s) => ({
                skill_label: s.skill_label,
                required_level: 3,
                candidate_level: overrides[s.id]?.override_level ?? parseLevel(s.ai_level),
                result:
                  (overrides[s.id]?.override_level ?? parseLevel(s.ai_level)) >= 3
                    ? "match"
                    : "gap",
                is_override: !!overrides[s.id],
              }))}
            />
          )}

          {/* Quick Fit/Gap Matcher Action Bar */}
          <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950 rounded-3xl p-6 text-white shadow-md flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-amber-400" />
                <h3 className="font-bold text-base text-white">Bandingkan dengan Lowongan (Fit/Gap)</h3>
              </div>
              <p className="text-xs text-slate-300">
                Pilih lowongan untuk menghasilkan tabulasi gap kompetensi &amp; rekomendasi kultur.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                <SelectTrigger className="w-60 bg-white/10 border-white/20 text-white rounded-xl text-xs h-10">
                  <SelectValue placeholder="Pilih lowongan..." />
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
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-xl text-xs h-10 px-4 shrink-0 shadow-xs"
              >
                Analisis Fit/Gap <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>

          {/* Configured Target Skills */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Target Kompetensi Utama
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {configuredSkills.length} Kategori Terpetakan
              </span>
            </div>

            <div className="space-y-3">
              {configuredSkills.map((skill) => (
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
          {discoveredSkills.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Kompetensi Terdeteksi Tambahan (Discovered Skills)
                </h2>
                <p className="text-xs text-slate-500">
                  Skill tambahan yang terdeteksi dan dieksplorasi oleh AI di luar penilaian awal.
                </p>
              </div>

              <div className="space-y-3">
                {discoveredSkills.map((skill) => (
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
        </>
      )}
    </div>
  );
}
