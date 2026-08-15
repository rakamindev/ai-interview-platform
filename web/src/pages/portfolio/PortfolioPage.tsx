import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SearchableSelect } from "@/components/ui/searchable-select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import TranscriptBubble from "@/components/interview/TranscriptBubble";
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
  Briefcase,
  Layers,
  FileDown,
  CheckCircle2,
  ExternalLink,
  MessageSquareQuote,
  Target,
  User
} from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy, TranscriptTurn, FitGapReport, Session } from "@/types";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("portfolio");

  // Core portfolio state
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);

  // Vacancies and Fit/Gap state
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [fitGapReport, setFitGapReport] = useState<FitGapReport | null>(null);
  const [loadingFitGap, setLoadingFitGap] = useState(false);

  // Transcript state
  const [transcriptTurns, setTranscriptTurns] = useState<TranscriptTurn[]>([]);
  const [loadingTranscript, setLoadingTranscript] = useState(false);

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

      // Auto-load latest analyzed FitGap report if available and none selected yet
      if (data.portfolio.fit_gap_reports && data.portfolio.fit_gap_reports.length > 0) {
        setSelectedVacancy((prev) => {
          if (!prev) {
            const latestReport = data.portfolio.fit_gap_reports[0];
            setFitGapReport(latestReport);
            return String(latestReport.vacancy_id);
          }
          return prev;
        });
      }
    }
  }, [sessionId]);

  useEffect(() => {
    Promise.all([
      fetchPortfolio(),
      vacanciesApi.list(),
      sessionsApi.get(Number(sessionId)),
      sessionsApi.getTranscript(Number(sessionId))
    ])
      .then(([, vRes, sRes, tRes]) => {
        setVacancies(vRes.data.vacancies);
        setSession(sRes.data.session);
        setCandidateName(sRes.data.session.candidate_name ?? null);
        setTranscriptTurns(tRes.data.turns);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  // Poll while generating portfolio
  usePolling(fetchPortfolio, 5000, generating);

  // Fetch or trigger FitGap report when vacancy changes
  const fetchFitGapForSelectedVacancy = useCallback(async (vacancyIdStr: string) => {
    if (!portfolio || !vacancyIdStr) {
      setFitGapReport(null);
      return;
    }

    // Check if already in loaded portfolio reports
    const existing = portfolio.fit_gap_reports?.find((r) => String(r.vacancy_id) === vacancyIdStr);
    if (existing) {
      setFitGapReport(existing);
      return;
    }

    setLoadingFitGap(true);
    try {
      const res = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyIdStr));
      setFitGapReport(res.data.report);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        // Trigger generation
        try {
          await portfoliosApi.triggerFitGap(portfolio.id, Number(vacancyIdStr));
          // Retry get after 1.2s
          setTimeout(async () => {
            try {
              const resRetry = await portfoliosApi.getFitGap(portfolio.id, Number(vacancyIdStr));
              setFitGapReport(resRetry.data.report);
            } catch {
              setFitGapReport(null);
            } finally {
              setLoadingFitGap(false);
            }
          }, 1200);
          return;
        } catch {
          setFitGapReport(null);
        }
      } else {
        setFitGapReport(null);
      }
    } finally {
      setLoadingFitGap(false);
    }
  }, [portfolio]);

  const handleVacancySelect = (vacId: string) => {
    setSelectedVacancy(vacId);
    if (vacId) {
      fetchFitGapForSelectedVacancy(vacId);
    } else {
      setFitGapReport(null);
    }
  };

  const handleOverrideSaved = (skillId: number, override: AssessorOverride) => {
    setOverrides((prev) => ({ ...prev, [skillId]: override }));
    // Refresh fitgap if active
    if (selectedVacancy) {
      fetchFitGapForSelectedVacancy(selectedVacancy);
    }
  };

  const handleRegeneratePortfolio = async () => {
    try {
      setGenerating(true);
      await sessionsApi.regeneratePortfolio(Number(sessionId));
    } catch (e) {
      console.error("Failed to regenerate:", e);
      setGenerating(false);
    }
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

  const handleDownloadTranscriptTxt = () => {
    if (transcriptTurns.length === 0) return;
    const lines = transcriptTurns.map((t) => {
      const label = t.speaker === "ai" ? "Rakamin AI Interviewer" : (candidateName || "Candidate");
      return `[${label}]\n${t.text}`;
    });
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Transcript-${(candidateName || "Candidate").replace(/\s+/g, "_")}-Session-${sessionId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadTranscriptPdf = () => {
    if (transcriptTurns.length === 0) return;

    const candidate = candidateName || "Kandidat";
    const role = session?.assessment_name || session?.role_title || "Posisi Wawancara";
    const dateFormatted = new Date(session?.created_at || Date.now()).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const turnsHtml = transcriptTurns
      .map((t) => {
        const isAI = t.speaker === "ai";
        return `
          <div style="margin-bottom: 16px; display: flex; flex-direction: column; align-items: ${isAI ? "flex-start" : "flex-end"};">
            <div style="font-size: 11px; font-weight: 700; color: ${isAI ? "#0d9488" : "#475569"}; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px;">
              ${isAI ? "🤖 Rakamin AI Interviewer" : `👤 ${candidate}`}
            </div>
            <div style="max-width: 85%; padding: 12px 16px; border-radius: 14px; font-size: 13px; line-height: 1.6; background-color: ${
              isAI ? "#f8fafc" : "#0f172a"
            }; color: ${isAI ? "#1e293b" : "#ffffff"}; border: 1px solid ${
          isAI ? "#e2e8f0" : "#0f172a"
        }; box-shadow: 0 1px 2px rgba(0,0,0,0.05); white-space: pre-wrap;">
              ${t.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
            </div>
          </div>
        `;
      })
      .join("");

    const docHtml = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Transkrip Wawancara - ${candidate} (Sesi #${sessionId})</title>
        <style>
          @page { size: A4; margin: 18mm 15mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a; margin: 0; padding: 24px; background: #fff;
          }
          .header {
            border-bottom: 2px solid #0d9488; padding-bottom: 16px; margin-bottom: 20px;
            display: flex; justify-content: space-between; align-items: flex-start;
          }
          .brand { font-size: 20px; font-weight: 800; color: #0f172a; }
          .brand span { color: #0d9488; }
          .meta-box {
            background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;
            padding: 12px 16px; margin-bottom: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; font-size: 12px;
          }
          .meta-item { display: flex; flex-direction: column; }
          .meta-label { color: #64748b; font-size: 11px; font-weight: 600; }
          .meta-value { color: #0f172a; font-weight: 700; margin-top: 2px; }
          .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">Rakamin <span>AI Interview</span></div>
            <div style="font-size: 13px; color: #64748b; margin-top: 4px; font-weight: 500;">Official Audio Interview Transcript</div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #64748b;">
            <div>Session ID: #${sessionId}</div>
            <div>Generated: ${new Date().toLocaleDateString("id-ID")}</div>
          </div>
        </div>
        <div class="meta-box">
          <div class="meta-item"><span class="meta-label">Nama Kandidat</span><span class="meta-value">${candidate}</span></div>
          <div class="meta-item"><span class="meta-label">Posisi Lowongan</span><span class="meta-value">${role}</span></div>
          <div class="meta-item"><span class="meta-label">Waktu Sesi</span><span class="meta-value">${dateFormatted}</span></div>
          <div class="meta-item"><span class="meta-label">Total Percakapan</span><span class="meta-value">${transcriptTurns.length} Dialog Turns</span></div>
        </div>
        <div>${turnsHtml}</div>
        <div class="footer">Dokumen ini merupakan rekaman transkrip otomatis resmi dari sesi wawancara suara platform Rakamin AI Interview.</div>
      </body>
      </html>
    `;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(docHtml);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }, 300);
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
            title="Kembali"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="space-y-1 min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Hasil Evaluasi Sesi #{sessionId}
            </h1>
            {candidateName && (
              <div className="flex items-center gap-2 pt-0.5">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 max-w-[280px] sm:max-w-md truncate"
                  title={candidateName}
                >
                  <User className="h-3 w-3 shrink-0" />
                  <span className="truncate">{candidateName}</span>
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">Kandidat</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              Evaluasi kompetensi skill, komparasi benchmark lowongan, dan transkrip dialog suara.
            </p>
          </div>
        </div>

        {/* Global Export & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegeneratePortfolio}
            disabled={generating}
            className="h-9 px-3 text-xs font-semibold border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs"
            title={isComplete ? "Evaluasi ulang transkrip sesi ini dengan model AI" : "Generate evaluasi transkrip sesi ini dengan model AI"}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 text-primary ${generating ? "animate-spin" : ""}`} />
            <span>
              {generating
                ? "Mengevaluasi..."
                : isComplete
                ? "Evaluasi Ulang AI"
                : "Generate Evaluasi AI"}
            </span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
            disabled={!isComplete || !!exporting}
            className="h-9 px-3 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
            title={!isComplete ? "Laporan belum selesai digenerate" : "Unduh Laporan PDF Lengkap"}
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
            className="h-9 px-3 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
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
              Model AI sedang membaca seluruh rekaman transkrip dan memetakan skor kompetensi (L1–L5) beserta kutipan bukti jawaban kandidat. Proses ini membutuhkan waktu sekitar beberapa detik.
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
              Laporan Evaluasi Belum Tersedia
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
              <span>Coba Generate Evaluasi</span>
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

      {/* ── State 3: Ready / Complete State with Unified Tabs ── */}
      {isComplete && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Unified Tab Bar */}
          <TabsList className="grid grid-cols-3 w-full bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 shadow-2xs h-11">
            <TabsTrigger
              value="portfolio"
              className="rounded-xl font-bold text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-xs transition-all flex items-center gap-2"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Evaluasi Skill</span>
            </TabsTrigger>
            <TabsTrigger
              value="fitgap"
              className="rounded-xl font-bold text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-xs transition-all flex items-center gap-2"
            >
              <Target className="h-3.5 w-3.5" />
              <span>Kecocokan Lowongan</span>
            </TabsTrigger>
            <TabsTrigger
              value="transcript"
              className="rounded-xl font-bold text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-xs transition-all flex items-center gap-2"
            >
              <MessageSquareQuote className="h-3.5 w-3.5" />
              <span>Transkrip ({transcriptTurns.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* ══════ TAB 1: EVALUASI SKILL ══════ */}
          <TabsContent value="portfolio" className="space-y-6 focus:outline-none">
            {/* Configured Skills Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Kompetensi Utama yang Diuji
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
                    Skill Tambahan yang Terdeteksi
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
          </TabsContent>

          {/* ══════ TAB 2: ANALISIS FIT / GAP ══════ */}
          <TabsContent value="fitgap" className="space-y-6 focus:outline-none">
            {/* Vacancy Selector Bar */}
            <div className="bg-slate-50/90 rounded-2xl border border-slate-200/80 p-5 space-y-3 shadow-2xs">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  Pilih Template Lowongan Benchmark
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pilih posisi lowongan (*Vacancy*) untuk membandingkan kecocokan skill kandidat dengan standar yang dibutuhkan.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                <SearchableSelect
                  options={vacancies.map((v) => ({
                    value: String(v.id),
                    label: v.role_title,
                    description: `${v.skills?.length || 0} skills diukur`,
                  }))}
                  value={selectedVacancy}
                  onChange={handleVacancySelect}
                  placeholder="Ketik untuk mencari lowongan benchmark..."
                  className="w-full sm:w-80"
                  icon={<Briefcase className="h-3.5 w-3.5 text-primary shrink-0" />}
                  hideAllOption={true}
                />

                {selectedVacancy && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchFitGapForSelectedVacancy(selectedVacancy)}
                    disabled={loadingFitGap}
                    className="h-10 rounded-xl text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-100"
                  >
                    {loadingFitGap ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 text-primary" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                    )}
                    <span>Hitung Ulang</span>
                  </Button>
                )}
              </div>

              {portfolio.fit_gap_reports && portfolio.fit_gap_reports.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Lowongan yang Telah Dianalisis:
                  </span>
                  {portfolio.fit_gap_reports.map((rep) => {
                    const vInfo = vacancies.find((v) => v.id === rep.vacancy_id);
                    const title = vInfo?.role_title || `Lowongan #${rep.vacancy_id}`;
                    const isSelected = selectedVacancy === String(rep.vacancy_id);
                    return (
                      <button
                        key={rep.id}
                        type="button"
                        onClick={() => handleVacancySelect(String(rep.vacancy_id))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-primary text-white shadow-xs"
                            : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        <Briefcase className="h-3 w-3" />
                        <span>{title}</span>
                        {isSelected && <CheckCircle2 className="h-3 w-3" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Fit/Gap Loading */}
            {loadingFitGap && (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-10 text-center space-y-4 shadow-2xs">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                <p className="text-xs text-muted-foreground">Menghitung analisis kecocokan skill...</p>
              </div>
            )}

            {/* Fit/Gap Results Render */}
            {!loadingFitGap && fitGapReport && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                {/* Comparison Table Card */}
                <Card className="border-slate-200/80 shadow-2xs">
                  <CardHeader className="py-4 px-5 border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="text-base font-bold text-slate-900">
                      Tabel Perbandingan Skill (*Skill Comparison*)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Komparasi antara level kemampuan kandidat dengan level minimum yang dipersyaratkan lowongan.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5">
                    <ComparisonTable comparisons={fitGapReport.skill_comparisons} />
                  </CardContent>
                </Card>

                {/* Culture & Overall Narratives */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-slate-200/80 shadow-2xs">
                    <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/50">
                      <CardTitle className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Kesesuaian Budaya &amp; Kompetensi
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
                      {fitGapReport.culture_narrative || (
                        <span className="text-muted-foreground italic">Evaluasi budaya tidak ditentukan.</span>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200/80 shadow-2xs">
                    <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/50">
                      <CardTitle className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Rekomendasi Perekrutan Keseluruhan
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                      {fitGapReport.overall_narrative || (
                        <span className="text-muted-foreground italic">Ringkasan rekomendasi sedang diproses.</span>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Empty State when no vacancy is selected */}
            {!selectedVacancy && !loadingFitGap && (
              <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-8 text-center space-y-2">
                <Target className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-800">Belum Ada Lowongan yang Dipilih</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Silakan pilih salah satu lowongan di atas untuk melihat tabel komparasi skill dan persentase kecocokan kandidat.
                </p>
              </div>
            )}
          </TabsContent>

          {/* ══════ TAB 3: TRANSKRIP PERCAKAPAN ══════ */}
          <TabsContent value="transcript" className="space-y-4 focus:outline-none">
            {/* Transcript Actions Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-slate-50/90 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Rekaman Dialog Suara Real-time</span>
                  <span className="text-[11px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-md">
                    Live Audio 16kHz
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Total {transcriptTurns.length} interaksi percakapan kerekam antara AI dan Kandidat.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTranscriptPdf}
                  className="h-9 px-3 text-xs font-semibold border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  <FileDown className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  <span>Unduh PDF</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTranscriptTxt}
                  className="h-9 px-3 text-xs font-semibold border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                  <span>Unduh .txt</span>
                </Button>
              </div>
            </div>

            {/* Transcript Stream */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 space-y-4 shadow-2xs">
              {transcriptTurns.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground italic">
                  Belum ada transkrip terekam untuk sesi ini.
                </div>
              ) : (
                transcriptTurns.map((turn, idx) => (
                  <TranscriptBubble
                    key={idx}
                    speaker={turn.speaker}
                    text={turn.text}
                  />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
