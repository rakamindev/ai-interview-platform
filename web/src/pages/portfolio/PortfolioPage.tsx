import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, FileText, Award, BarChart3, CheckCircle2 } from "lucide-react";
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
    if (!portfolio) return;
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        selectedVacancy ? Number(selectedVacancy) : undefined
      );
      if (format === "json") {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
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

  // Metrics summary
  const summaryStats = useMemo(() => {
    if (!portfolio?.skills) return null;
    const assessed = portfolio.skills.filter((s) => s.ai_level !== null && s.ai_level !== undefined);
    const highConfidence = portfolio.skills.filter((s) => s.ai_confidence?.toLowerCase() === "high");
    const avgScore = assessed.length > 0
      ? (assessed.reduce((acc, s) => acc + (Number(s.ai_level) || 0), 0) / assessed.length).toFixed(1)
      : "-";

    return {
      total: portfolio.skills.length,
      assessedCount: assessed.length,
      highConfidenceCount: highConfidence.length,
      avgScore,
    };
  }, [portfolio]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 bg-card border border-border/80 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            to={`/assessments/${id}/invite`}
            className="p-2.5 rounded-xl bg-muted/60 border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">Portofolio Kompetensi Kandidat</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                Verified
              </span>
            </div>
            {candidateName && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Kandidat: <strong className="text-foreground font-semibold">{candidateName}</strong>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold border border-border/80 bg-muted/40 rounded-xl px-3.5 py-2 hover:bg-muted text-foreground transition-colors shadow-sm"
          >
            <FileText className="h-3.5 w-3.5 text-primary" />
            Transkrip Sesi
          </Link>
          {!generating && portfolio && portfolio.generation_status === "complete" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
                className="border-border/80 bg-muted/40 rounded-xl text-xs text-foreground hover:bg-muted font-semibold"
              >
                {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Download className="h-3.5 w-3.5 mr-1 text-primary" />}
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
                disabled={!!exporting}
                className="border-border/80 bg-muted/40 rounded-xl text-xs text-foreground hover:bg-muted font-semibold"
              >
                {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Download className="h-3.5 w-3.5 mr-1 text-primary" />}
                JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Generating state */}
      {generating && (
        <div className="border border-border/80 bg-card rounded-3xl p-12 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <div>
            <p className="text-base font-bold text-foreground">Memproses Evaluasi Portofolio AI...</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
              Model AI sedang menganalisis transkrip wawancara, mencocokkan anchor perilaku L1-L5, dan mengekstrak bukti keahlian kandidat.
            </p>
          </div>
        </div>
      )}

      {/* Failed state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <div className="border border-destructive/30 bg-destructive/10 rounded-3xl p-8 text-center space-y-3 shadow-sm">
          <p className="text-sm font-bold text-destructive">Generasi Portofolio Gagal</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">{portfolio.generation_error || "Terjadi kesalahan saat memproses evaluasi LLM."}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await sessionsApi.regeneratePortfolio(Number(sessionId));
              setGenerating(true);
            }}
            className="mt-2 border-destructive/30 text-destructive hover:bg-destructive/10 rounded-xl font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Coba Lagi
          </Button>
        </div>
      )}

      {/* Ready state */}
      {!generating && portfolio?.generation_status === "complete" && (
        <>
          {/* Metrics summary cards */}
          {summaryStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <BarChart3 className="h-3.5 w-3.5 text-primary" />
                  <span>Total Keahlian</span>
                </div>
                <div className="text-2xl font-black text-foreground">{summaryStats.total}</div>
                <div className="text-[11px] text-muted-foreground">Termasuk keahlian baru</div>
              </div>

              <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Dievaluasi</span>
                </div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {summaryStats.assessedCount}
                </div>
                <div className="text-[11px] text-muted-foreground">{summaryStats.total - summaryStats.assessedCount} belum dievaluasi</div>
              </div>

              <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  <span>High Confidence</span>
                </div>
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  {summaryStats.highConfidenceCount}
                </div>
                <div className="text-[11px] text-muted-foreground">Bukti sangat solid</div>
              </div>

              <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <Award className="h-3.5 w-3.5 text-primary" />
                  <span>Rata-Rata Level</span>
                </div>
                <div className="text-2xl font-black text-primary">
                  {summaryStats.avgScore}
                </div>
                <div className="text-[11px] text-muted-foreground">Skala 1 s/d 5</div>
              </div>
            </div>
          )}

          {/* Fit/Gap matching action banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-foreground">Analisis Kesesuaian Lowongan (Fit/Gap Report)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bandingkan profil kompetensi kandidat ini dengan persyaratan posisi yang sedang dibuka.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                <SelectTrigger className="h-9 w-full sm:w-48 bg-card border-border text-xs rounded-xl">
                  <SelectValue placeholder="Pilih Lowongan..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-card">
                  {vacancies.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)} className="text-xs">
                      {v.role_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleRunFitGap}
                disabled={!selectedVacancy}
                className="h-9 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs whitespace-nowrap shadow-sm"
              >
                Jalankan Fit/Gap
              </Button>
            </div>
          </div>

          {/* Configured skills section */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Keahlian Utama ({portfolio.skills?.filter((s) => !s.is_discovered).length ?? 0})
            </h2>
            <div className="space-y-3">
              {portfolio.skills
                ?.filter((s) => !s.is_discovered)
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

          {/* Discovered skills section */}
          {portfolio.skills?.some((s) => s.is_discovered) && (
            <div className="space-y-4 pt-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Zap className="h-4 w-4" />
                Keahlian Tambahan yang Ditemukan ({portfolio.skills.filter((s) => s.is_discovered).length})
              </h2>
              <div className="space-y-3">
                {portfolio.skills
                  ?.filter((s) => s.is_discovered)
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
        </>
      )}
    </div>
  );
}
