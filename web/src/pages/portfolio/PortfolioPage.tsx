import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import CandidateFeedbackCard from "@/components/portfolio/CandidateFeedbackCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { feedbackApi } from "@/services/feedback";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, FileText, AlertTriangle, AlertCircle, MessageSquareOff } from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy, CandidateFeedback } from "@/types";
import { useToast } from "@/components/ui/toast";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<CandidateFeedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [assessmentName, setAssessmentName] = useState<string | null>(null);
  const { toast } = useToast();
  usePageTitle(candidateName ? `Portfolio · ${candidateName}` : "Portfolio");

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
    Promise.all([
      fetchPortfolio(),
      vacanciesApi.list(),
      sessionsApi.get(Number(sessionId)),
      feedbackApi.getBySession(Number(sessionId)).catch(() => ({ data: { feedback: null } })),
    ])
      .then(([, vRes, sRes, fRes]) => {
        setVacancies(vRes.data.vacancies);
        setCandidateName(sRes.data.session.candidate_name ?? null);
        setAssessmentName(sRes.data.session.assessment?.name ?? null);
        setFeedback((fRes as any)?.data?.feedback ?? null);
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setFeedbackLoading(false);
      });
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
        toast("Portfolio exported as JSON");
      } else {
        const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-${sessionId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast("Portfolio exported as PDF");
      }
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumb
        items={[
          { label: "Assessments", href: "/assessments" },
          { label: assessmentName || "Assessment", href: `/assessments/${id}/invite` },
          { label: candidateName || `Candidate #${sessionId}`, href: `/assessments/${id}/invite` },
          { label: "Portfolio" },
        ]}
      />

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
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
              >
                {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
                disabled={!!exporting}
              >
                {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                JSON
              </Button>
            </>
          )}
        </div>
      </div>

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

      {/* Empty transcript state */}
      {!generating && (portfolio?.context_status === "empty_transcript" || (portfolio?.generation_status === "failed" && portfolio?.generation_error?.includes("Transkrip interview kosong"))) && (
        <div className="border border-amber-500/30 bg-amber-500/5 rounded-xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <MessageSquareOff className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground text-base">Transkrip Interview Kosong</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {portfolio?.context_notes || "Sesi interview tidak memiliki rekaman percakapan kandidat. Evaluasi kompetensi tidak dapat dilakukan karena kandidat tidak memberikan jawaban."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/transcript`}
              className="inline-flex items-center gap-1.5 text-xs font-medium border rounded-md px-3 py-1.5 bg-background hover:bg-accent transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              Periksa Transkrip
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await sessionsApi.regeneratePortfolio(Number(sessionId));
                  setGenerating(true);
                } catch (err: any) {
                  toast(err?.response?.data?.error || "Gagal regenerate portfolio: transkrip kosong");
                }
              }}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Coba Lagi
            </Button>
          </div>
        </div>
      )}

      {/* General failed state */}
      {!generating && portfolio?.generation_status === "failed" && portfolio?.context_status !== "empty_transcript" && !portfolio?.generation_error?.includes("Transkrip interview kosong") && (
        <div className="border border-destructive/40 bg-destructive/5 rounded-xl p-6 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-destructive">Portfolio generation failed.</p>
            {portfolio?.generation_error && (
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                {portfolio.generation_error}
              </p>
            )}
          </div>
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
          {/* Out of context warning banner */}
          {portfolio.context_status === "out_of_context" && (
            <div className="border border-rose-500/30 bg-rose-500/10 dark:bg-rose-950/20 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                    Jawaban Tidak Sesuai Konteks (Out of Context)
                  </h3>
                  <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300">
                    Peringatan
                  </span>
                </div>
                <p className="text-xs text-rose-600/90 dark:text-rose-300/90">
                  {portfolio.context_notes || "Sebagian besar jawaban kandidat terdeteksi tidak relevan atau di luar konteks posisi yang dinilai. Harap evaluasi ulang transkrip dan sesuaikan level kompetensi secara manual bila diperlukan."}
                </p>
              </div>
            </div>
          )}

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
          <div className="flex items-center gap-3">
            <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Choose vacancy..." />
              </SelectTrigger>
              <SelectContent>
                {vacancies.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.role_title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleRunFitGap} disabled={!selectedVacancy}>
              Run Fit/Gap Analysis →
            </Button>
          </div>
        </>
      )}

      {/* Candidate Feedback & Complaints Section */}
      <Separator />
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Candidate Feedback & Experience</h2>
          {feedback?.has_complaint && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 font-medium border border-red-500/20">
              Complaint Reported
            </span>
          )}
        </div>
        <CandidateFeedbackCard
          feedback={feedback}
          loading={feedbackLoading}
        />
      </div>
    </div>
  );
}
