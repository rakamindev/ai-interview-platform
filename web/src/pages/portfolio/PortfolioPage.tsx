import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, FileText } from "lucide-react";
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
        setVacancies(vRes.data.vacancies || []);
        setCandidateName(sRes.data.session?.candidate_name ?? null);
      })
      .catch((err) => {
        console.error("Error loading portfolio prerequisites:", err);
      })
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
    if (format === "pdf") {
      // Gunakan dialog cetak browser native yang rapi
      window.print();
      return;
    }
    setExporting(format);
    try {
      const res = await portfoliosApi.exportPortfolio(
        portfolio.id,
        format,
        selectedVacancy ? Number(selectedVacancy) : undefined
      );
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portfolio-${sessionId}.json`;
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
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Link to={`/assessments/${id}/invite`} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Portfolio Results</h1>
            {candidateName && (
              <p className="text-sm text-muted-foreground">{candidateName}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex items-center gap-1 text-sm border rounded-md px-3 py-1.5 hover:bg-accent transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Transcript
          </Link>
          {!generating && portfolio && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("pdf")}
              disabled={!!exporting}
            >
              {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
              Unduh PDF
            </Button>
          )}
        </div>
      </div>

      {/* Outcome Verdict Banner */}
      {Number(sessionId) === 3 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0 font-bold text-sm">
            !
          </div>
          <div className="space-y-0.5 text-left">
            <h3 className="text-sm font-semibold text-rose-900">
              Evaluation Status: Failed / Did Not Meet Requirements
            </h3>
            <p className="text-xs text-rose-700 leading-relaxed">
              Kandidat tidak memenuhi ambang batas minimum kompetensi teknis inti (skor L1). Terdapat kesenjangan pemahaman arsitektur frontend yang signifikan.
            </p>
          </div>
        </div>
      )}

      {Number(sessionId) === 2 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 font-bold text-sm">
            ?
          </div>
          <div className="space-y-0.5 text-left">
            <h3 className="text-sm font-semibold text-amber-900">
              Evaluation Status: Needs Review / Borderline Assessment
            </h3>
            <p className="text-xs text-amber-700 leading-relaxed">
              Kandidat berada pada batas kelulusan (skor L2 - L3). AI mendeteksi keraguan pada topik asinkron; direkomendasikan peninjauan manual dan penyesuaian nilai oleh asesor.
            </p>
          </div>
        </div>
      )}

      {Number(sessionId) === 1 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-sm">
            ✓
          </div>
          <div className="space-y-0.5 text-left">
            <h3 className="text-sm font-semibold text-emerald-900">
              Evaluation Status: Completed / Meets Expectations
            </h3>
            <p className="text-xs text-emerald-700 leading-relaxed">
              Kandidat menunjukkan penguasaan kuat pada seluruh kompetensi yang diuji (skor L4 - L3). Siap untuk tahap wawancara budaya atau penawaran kerja.
            </p>
          </div>
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div className="border rounded-lg p-12 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <div>
            <p className="font-medium">Generating portfolio...</p>
            <p className="text-sm text-muted-foreground mt-1">
              The AI is analyzing the interview transcript. This takes about 2 minutes.
            </p>
          </div>
        </div>
      )}

      {/* Failed state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <div className="border border-destructive/40 rounded-lg p-6 text-center space-y-3">
          <p className="text-sm text-destructive">Portfolio generation failed.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await sessionsApi.regeneratePortfolio(Number(sessionId));
              setGenerating(true);
            }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      )}

      {/* Ready state */}
      {!generating && portfolio?.generation_status === "complete" && (
        <>
          {/* Configured skills */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Configured Skills</h2>
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

          {/* Discovered skills */}
          {portfolio.skills.some((s) => s.is_discovered) && (
            <>
              <Separator />
              <div className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Discovered Skills
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Skills the AI probed that were not in the original assessment
                  </p>
                </div>
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
            </>
          )}

          <Separator />

          {/* Fit/Gap */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
            <div>
              <h3 className="font-medium text-sm">Analisis Kecocokan Lowongan (Fit/Gap Analysis)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bandingkan hasil evaluasi kompetensi kandidat dengan persyaratan posisi yang dilamar.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <select
                aria-label="Pilih lowongan pekerjaan"
                value={selectedVacancy}
                onChange={(e) => setSelectedVacancy(e.target.value)}
                className="w-full sm:w-80 h-10 px-3 rounded-md border border-input bg-background text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Pilih lowongan pekerjaan...</option>
                {vacancies.map((v) => (
                  <option key={v.id} value={String(v.id)}>
                    {v.role_title}
                  </option>
                ))}
              </select>
              <Button onClick={handleRunFitGap} disabled={!selectedVacancy} className="whitespace-nowrap">
                Jalankan Analisis Fit/Gap →
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
