import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, FileText, LayoutDashboard, Search } from "lucide-react";
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

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-pulse">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-6 rounded-xl border shadow-sm">
        <div className="flex items-center gap-4">
          <Link to={`/assessments/${id}/invite`} className="flex items-center justify-center w-10 h-10 rounded-full bg-muted hover:bg-muted/80 transition-colors">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Hasil Portfolio</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Kandidat: <span className="font-semibold text-foreground">{candidateName || 'Anonim'}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            variant="secondary"
            className="flex-1 sm:flex-none shadow-sm"
            onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/transcript`)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Transkrip
          </Button>
          {!generating && portfolio && (
            <>
              <Button
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
              >
                {exporting === "pdf" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Ekspor PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Generating state */}
      {generating && (
        <Card className="border-primary/20 shadow-md">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="bg-primary/10 p-4 rounded-full">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Membuat Portfolio AI...</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Sistem sedang menganalisis transkrip wawancara untuk mengekstrak keahlian dan wawasan. Proses ini membutuhkan waktu beberapa menit.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Failed state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <Card className="border-destructive/40 bg-destructive/5 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div className="bg-destructive/10 p-3 rounded-full">
              <RefreshCw className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-destructive mb-1">Gagal Membuat Portfolio</h3>
              <p className="text-sm text-muted-foreground mb-4">Terjadi kesalahan saat menganalisis wawancara.</p>
              <Button
                variant="destructive"
                onClick={async () => {
                  await sessionsApi.regeneratePortfolio(Number(sessionId));
                  setGenerating(true);
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Coba Ulang
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ready state */}
      {!generating && portfolio?.generation_status === "complete" && (
        <div className="space-y-8">
          
          {/* Fit/Gap Analysis Box - Moved to top for visibility */}
          <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20 shadow-md overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Search className="w-24 h-24 text-primary" />
            </div>
            <CardContent className="p-6 relative z-10">
              <h3 className="text-lg font-bold mb-2">Analisis Fit/Gap</h3>
              <p className="text-sm text-muted-foreground mb-5 max-w-xl">
                Bandingkan profil kandidat ini dengan persyaratan lowongan kerja tertentu untuk melihat kecocokan mereka.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                  <SelectTrigger className="w-full sm:w-72 bg-background">
                    <SelectValue placeholder="Pilih lowongan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vacancies.length === 0 ? (
                      <SelectItem value="empty" disabled>Tidak ada lowongan tersedia</SelectItem>
                    ) : (
                      vacancies.map((v) => (
                        <SelectItem key={v.id} value={String(v.id)}>
                          {v.role_title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleRunFitGap} 
                  disabled={!selectedVacancy || selectedVacancy === "empty"}
                  className="w-full sm:w-auto shadow-sm"
                >
                  Jalankan Analisis <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Configured skills */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold tracking-tight">Keahlian Utama</h2>
            </div>
            <div className="grid gap-4">
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
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-amber-500" />
                <h2 className="text-xl font-bold tracking-tight">Keahlian Tambahan Ditemukan</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Keahlian ini tidak ada di kriteria awal, namun AI menemukannya saat wawancara berlangsung.
              </p>
              <div className="grid gap-4">
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
        </div>
      )}
    </div>
  );
}
