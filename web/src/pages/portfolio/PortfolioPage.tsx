import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  Clock,
  Eye,
  Award,
  BarChart3,
  ShieldCheck,
  Briefcase,
  UserCheck,
} from "lucide-react";
import { parseLevel, LEVEL_LABELS, LEVEL_DESCRIPTIONS } from "@/utils/constants";
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
  const [sessionNotEnded, setSessionNotEnded] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await sessionsApi.getPortfolio(Number(sessionId));
      const data = res.data as any;
      if (data.status === "session_not_ended") {
        setSessionNotEnded(true);
        setSessionStatus(data.session_status || "pending");
        setGenerating(false);
        return;
      }
      setSessionNotEnded(false);
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
    } catch {
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

  const stats = useMemo(() => {
    if (!portfolio || !portfolio.skills || portfolio.skills.length === 0) {
      return { total: 0, maxLevel: 1, discovered: 0, overrideCount: 0 };
    }
    const levels = portfolio.skills.map((s) => {
      const ov = overrides[s.id];
      return ov ? ov.override_level : parseLevel(s.ai_level);
    });
    const maxLevel = Math.max(...levels, 1);
    const discovered = portfolio.skills.filter((s) => s.is_discovered).length;
    const overrideCount = Object.keys(overrides).length;
    return {
      total: portfolio.skills.length,
      maxLevel,
      discovered,
      overrideCount,
    };
  }, [portfolio, overrides]);

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
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            to={`/assessments/${id}/invite`}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                {candidateName ? `${candidateName}'s Result` : "Candidate Assessment Result"}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex items-center gap-1.5 text-xs font-medium border border-slate-200 bg-white rounded-md px-3 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <FileText className="h-3.5 w-3.5 text-slate-500" />
            Interview Transcript
          </Link>
          {!generating && portfolio && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium bg-white"
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
              >
                {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1 text-slate-500" />}
                Export PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium bg-white"
                onClick={() => handleExport("json")}
                disabled={!!exporting}
              >
                {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1 text-slate-500" />}
                Export JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {sessionNotEnded && (
        <div className="border border-amber-200 rounded-lg p-10 text-center space-y-3 bg-amber-50/50">
          <Clock className="h-10 w-10 text-amber-500 mx-auto" />
          <p className="font-semibold text-slate-900 text-base">Interview Session Not Concluded</p>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            This interview session is currently <span className="font-medium text-amber-700">{sessionStatus}</span>. The portfolio results and evaluation report will be generated once the interview has concluded.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link to={`/assessments/${id}/sessions/${sessionId}/monitor`}>
              <Button size="sm" variant="outline" className="bg-white">
                <Eye className="h-3.5 w-3.5 mr-1.5" /> Monitor Live Session
              </Button>
            </Link>
            <Link to={`/assessments/${id}/invite`}>
              <Button size="sm" variant="outline" className="bg-white">
                Back to Candidates
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div className="border border-slate-200 bg-white rounded-lg p-12 text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto" />
          <div>
            <p className="font-semibold text-slate-900 text-base">Synthesizing candidate portfolio...</p>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Our AI evaluation engine is analyzing the interview dialogue against proficiency rubrics. This takes under 2 minutes.
            </p>
          </div>
        </div>
      )}

      {/* Failed state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <div className="border border-destructive/40 bg-red-50/50 rounded-lg p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-destructive">Portfolio generation encountered an evaluation error.</p>
          {portfolio.generation_error && (
            <p className="text-xs text-slate-700 max-w-md mx-auto font-mono bg-white py-1.5 px-3 rounded border border-red-200">
              {portfolio.generation_error}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="bg-white"
            onClick={async () => {
              await sessionsApi.regeneratePortfolio(Number(sessionId));
              setGenerating(true);
            }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry Synthesis
          </Button>
        </div>
      )}

      {/* Ready state */}
      {!generating && portfolio?.generation_status === "complete" && (
        <>

          {/* Configured skills */}
          <div className="space-y-3">
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
            <>
              <Separator />
              <div className="space-y-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Emergent Discovered Competencies
                  </h2>
                  <p className="text-xs text-slate-500">
                    Additional technical competencies uncovered dynamically during the interview dialogue
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
            </>
          )}

          <Separator />

          {/* Fit/Gap */}
          <Card className="border border-slate-200 shadow-none bg-slate-50/70">
            <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-slate-700" />
                  <h3 className="text-sm font-semibold text-slate-900">Benchmark Against Open Vacancies</h3>
                </div>
                <p className="text-xs text-slate-500 max-w-xl">
                  Compare this candidate's proven competencies against specific job requirements to generate a Fit/Gap gap analysis and mentorship trajectory.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                  <SelectTrigger className="w-56 bg-white border-slate-200 text-xs">
                    <SelectValue placeholder="Choose vacancy..." />
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
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-4"
                >
                  Run Fit/Gap Analysis →
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
