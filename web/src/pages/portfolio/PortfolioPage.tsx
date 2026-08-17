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
import ResolveObjectionPanel from "@/components/portfolio/ResolveObjectionPanel";
import SystemHealthPanel from "@/components/portfolio/SystemHealthPanel";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [pageState, setPageState] = useState<"loading" | "ready" | "generating" | "error">("loading");
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [session, setSession] = useState<any | null>(null);

  const fetchPortfolio = useCallback(async () => {
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    const data = res.data as any;
    if (data.status === "generating" || data.portfolio?.generation_status === "generating" || data.portfolio?.generation_status === "pending") {
      setPageState("generating");
    } else if (data.portfolio) {
      setPortfolio(data.portfolio);
      setPageState("ready");
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
        setSession(sRes.data.session);
      })
      .catch(() => setPageState("error"));
  }, [fetchPortfolio, sessionId]);

  // Poll while generating
  usePolling(fetchPortfolio, 5000, pageState === "generating");

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
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(null);
    }
  };

  const handleStatusChange = async (newStatus: "pending" | "ended") => {
    try {
      if (newStatus === "ended") {
        const res = await sessionsApi.endSession(Number(sessionId), "manual_assessor");
        setSession(res.data.session);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (pageState === "loading") {
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
          {pageState === "ready" && portfolio && (
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

      {/* Resolve Panel for Recruiters */}
      {session && (
        <ResolveObjectionPanel session={session} onResolved={setSession} />
      )}

      {/* State: Pending / Active */}
      {session && session.status !== "ended" && (
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100/50 backdrop-blur-md border border-slate-200/60 rounded-2xl p-12 text-center shadow-sm">
          <div className="absolute inset-0 bg-grid-slate-100/[0.04] bg-[size:20px_20px]"></div>
          <div className="relative z-10 space-y-3">
            <div className="mx-auto w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center border border-slate-200/50 mb-4">
              <Loader2 className={`h-6 w-6 text-slate-400 ${session.status === 'pending' ? '' : 'animate-spin'}`} />
            </div>
            <p className="font-semibold text-slate-900 tracking-tight text-lg">
              {session.status === "pending" ? "Session Not Started" : "Session In Progress"}
            </p>
            <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
              {session.status === "pending" 
                ? "The candidate has not started this interview yet. Results will appear here once completed." 
                : "The candidate is currently taking this interview. Please wait for them to finish."}
            </p>
          </div>
        </div>
      )}

      {/* System Health / Audit Status Panel */}
      {session && session.status === "ended" && (
        <SystemHealthPanel session={session} />
      )}

      {/* Generating state */}
      {session?.status === "ended" && pageState === "generating" && (
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50/50 to-white backdrop-blur-md border border-indigo-100/60 rounded-2xl p-12 text-center shadow-sm">
          <div className="absolute inset-0 bg-grid-indigo-100/[0.04] bg-[size:20px_20px]"></div>
          <div className="relative z-10 space-y-4">
            <div className="mx-auto w-14 h-14 bg-indigo-100/50 rounded-full flex items-center justify-center border border-indigo-200/50 mb-2">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
            </div>
            <div>
              <p className="font-semibold text-indigo-950 tracking-tight text-lg">Generating portfolio...</p>
              <p className="text-sm text-indigo-600/80 mt-1.5 max-w-sm mx-auto leading-relaxed">
                The AI is analyzing the interview transcript. This takes about 2 minutes to complete.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Failed state */}
      {pageState === "ready" && portfolio?.generation_status === "failed" && (
        <div className="relative overflow-hidden bg-gradient-to-r from-rose-50/90 to-red-50/30 backdrop-blur-md border border-rose-200/80 rounded-2xl p-8 text-center shadow-sm transition-all hover:shadow-md">
          <div className="relative z-10 space-y-4">
            <div className="mx-auto w-12 h-12 bg-rose-100/50 rounded-full flex items-center justify-center border border-rose-200/50">
              <span className="text-xl">⚠️</span>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-rose-900 tracking-tight">Portfolio generation failed</p>
              <p className="text-sm text-rose-800/80">An unexpected error occurred during AI analysis.</p>
            </div>
            {session?.audit_status !== "retake_approved" && (
              <Button
                variant="outline"
                size="sm"
                className="bg-white/80 backdrop-blur-sm border-rose-300 text-rose-800 hover:bg-rose-50 transition-all shadow-sm"
                onClick={async () => {
                  await sessionsApi.regeneratePortfolio(Number(sessionId));
                  setPageState("generating");
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Try Again
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Ready state */}
      {pageState === "ready" && portfolio?.generation_status === "complete" && (
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
    </div>
  );
}
