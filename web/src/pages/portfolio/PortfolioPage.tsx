import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { Download, Loader2, RefreshCw, Zap, FileText, AlertTriangle } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { parseLevel, LEVEL_LABELS, LEVEL_DESCRIPTIONS } from "@/utils/constants";
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";

function friendlyGenerationError(raw?: string | null): string {
  if (!raw) return "Portfolio generation failed due to an unexpected error.";
  const lower = raw.toLowerCase();
  if (lower.includes("rate limit")) {
    return "Busy right now — retrying automatically. Please wait a moment.";
  }
  if (lower.includes("timeout")) {
    return "The request timed out. Please try again.";
  }
  if (lower.includes("no content")) {
    return "The AI did not return a result. Please try again.";
  }
  return raw;
}

function LevelPips({ level, expected }: { level: number; expected: number }) {
  return (
    <div className="space-y-1">
      <div className="flex gap-[3px]">
        {Array.from({ length: 5 }, (_, i) => {
          const pipLevel = i + 1;
          const isFilled = pipLevel <= level;
          const isCurrent = pipLevel === level;
          const isExpected = pipLevel === expected;
          return (
            <div
              key={i}
              className={cn(
                "flex-1 h-1 rounded-full transition-colors",
                isCurrent
                  ? "bg-teal-600"
                  : isFilled
                  ? "bg-teal-400"
                  : "bg-gray-200"
              )}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>L1</span>
        <span className={cn(level > 0 && "text-gray-700 font-medium")}>
          L{level > 0 ? level : "?"} {level > 0 ? "← candidate" : ""}
        </span>
        <span className="text-blue-700 font-semibold">L{expected} expected</span>
      </div>
    </div>
  );
}

function OverallScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? "#1D9E75" : score >= 40 ? "#EF9F27" : "#E24B4A";
  const textColor = score >= 70 ? "text-teal-700" : score >= 40 ? "text-amber-700" : "text-red-600";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
      <div className="relative w-[90px] h-[90px] mx-auto mb-3">
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="38" fill="none" stroke="#E9ECEF" strokeWidth="7" />
          <circle
            cx="45" cy="45" r="38" fill="none"
            stroke={color} strokeWidth="7"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className={cn("absolute inset-0 flex items-center justify-center text-2xl font-bold", textColor)}>
          {score}%
        </div>
      </div>
      <p className="text-xs text-gray-500">Overall fit score</p>
      <div className="mt-3">
        <span className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
          score >= 70 ? "bg-teal-50 text-teal-700" : score >= 40 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
        )}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {score >= 70 ? "Good fit" : score >= 40 ? "Partial fit" : "Significant gaps detected"}
        </span>
      </div>
    </div>
  );
}

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
  const [sessionDate, setSessionDate] = useState<string | null>(null);
  const [sessionDuration, setSessionDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    const data = res.data as any;
    if (data.status === "generating" || data.portfolio?.generation_status === "generating" || data.portfolio?.generation_status === "pending") {
      setGenerating(true);
    } else if (data.portfolio) {
      setPortfolio(data.portfolio);
      setGenerating(false);
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
        const s = sRes.data.session;
        setCandidateName(s.candidate_name ?? null);
        setSessionDate(s.created_at ?? null);
        setSessionDuration(s.duration_seconds ?? null);
      })
      .catch(() => {
        setError("Failed to load portfolio data.");
      })
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

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

  const handleRetry = async () => {
    await sessionsApi.regeneratePortfolio(Number(sessionId));
    setGenerating(true);
  };

  const configuredSkills = portfolio?.skills.filter((s) => !s.is_discovered) ?? [];
  const discoveredSkills = portfolio?.skills.filter((s) => s.is_discovered) ?? [];
  const hasOverrides = Object.keys(overrides).length > 0;

  const formatDate = (d: string | null) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "";
    const mins = Math.round(seconds / 60);
    return `${mins} min`;
  };

  if (loading) {
    return (
      <div className="max-w-[1060px] mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1060px] mx-auto space-y-4">
        <Breadcrumb items={[{ label: "Sessions", href: `/assessments/${id}/invite` }]} />
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-sm text-gray-500">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate(`/assessments/${id}/invite`)}>
            Back to Sessions
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1060px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Breadcrumb items={[
            { label: "Sessions", href: `/assessments/${id}/invite` },
            { label: "Portfolio" }
          ]} />
          <h1 className="text-xl font-semibold mt-1">Portfolio Results</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {[candidateName, sessionDate && formatDate(sessionDate)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3.5 py-2 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <FileText className="h-4 w-4" />
            Transcript
          </Link>
          {!generating && portfolio && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting}>
                {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!!exporting}>
                {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Generating state */}
      {generating && (
        <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="font-semibold text-gray-900">Generating portfolio...</p>
          <p className="text-sm text-gray-500 mt-1">The AI is analyzing the interview transcript. This takes about 2 minutes.</p>
        </div>
      )}

      {/* Failed state — P3.25 error banner + empty state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <>
          <div className="flex items-start gap-3.5 bg-amber-50 border border-amber-200 rounded-xl p-5">
            <RefreshCw className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">{friendlyGenerationError(portfolio.generation_error)}</p>
              {portfolio.generation_error && portfolio.generation_error !== "null" && (
                <p className="text-xs text-amber-600 mt-1">Technical detail: {portfolio.generation_error}</p>
              )}
            </div>
            <Button
              variant="outline" size="sm"
              className="flex-shrink-0 border-amber-200 text-amber-700 hover:bg-amber-100"
              onClick={handleRetry}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
            </Button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl py-20 px-5 text-center">
            <div className="w-[52px] h-[52px] rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-[15px] font-semibold text-gray-900 mb-1">Analysis not ready yet</p>
            <p className="text-sm text-gray-500 mb-5 max-w-md mx-auto">
              The AI is still processing this session's results. This usually takes under 30 seconds. You can also view the raw transcript while you wait.
            </p>
            <div className="flex gap-2.5 justify-center">
              <Link
                to={`/assessments/${id}/sessions/${sessionId}/transcript`}
                className="inline-flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-50"
              >
                View transcript
              </Link>
              <Button onClick={handleRetry}>
                <RefreshCw className="h-4 w-4 mr-1.5" /> Retry now
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Ready state */}
      {!generating && portfolio?.generation_status === "complete" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">
          {/* Main content */}
          <div className="space-y-3.5">
            {configuredSkills.map((skill) => (
              <SkillPortfolioCard
                key={skill.id}
                skill={skill}
                override={overrides[skill.id]}
                onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                expectedLevel={3}
              />
            ))}

            {discoveredSkills.length > 0 && (
              <>
                <div className="border-t border-gray-200 my-4" />
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Discovered Skills
                  </h2>
                  <p className="text-xs text-gray-500 mb-3">Skills the AI probed that were not in the original assessment</p>
                </div>
                {discoveredSkills.map((skill) => (
                  <SkillPortfolioCard
                    key={skill.id}
                    skill={skill}
                    override={overrides[skill.id]}
                    onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                    expectedLevel={3}
                  />
                ))}
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-3">
            <OverallScoreRing score={35} />

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[13px] font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-teal-600"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                Skill summary
              </p>
              <div className="space-y-3">
                {configuredSkills.map((skill) => {
                  const level = parseLevel(skill.ai_level);
                  const width = (level / 5) * 100;
                  const barColor = level >= 4 ? "bg-teal-400" : level >= 3 ? "bg-teal-400" : level >= 2 ? "bg-amber-400" : "bg-red-400";
                  const textColor = level >= 4 ? "text-teal-700" : level >= 3 ? "text-teal-700" : level >= 2 ? "text-amber-700" : "text-red-600";
                  return (
                    <div key={skill.id}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700 truncate">{skill.skill_label}</span>
                        <span className={cn("text-xs font-medium", textColor)}>{LEVEL_LABELS[level]}</span>
                      </div>
                      <div className="h-[5px] bg-gray-200 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", barColor)} style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[13px] font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-teal-600"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Session info
              </p>
              <div className="space-y-0">
                {[
                  ["Candidate", candidateName || "—"],
                  ["Duration", formatDuration(sessionDuration)],
                  ["Submitted", sessionDate ? formatDate(sessionDate) : "—"],
                  ["Human override", hasOverrides ? "Applied" : "None"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-b-0 text-xs">
                    <span className="text-gray-500">{k}</span>
                    <span className="text-gray-900 font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-[13px] font-semibold text-gray-900">Run Fit/Gap Analysis</p>
              <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                <SelectTrigger className="w-full text-xs">
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
              <Button className="w-full" size="sm" onClick={handleRunFitGap} disabled={!selectedVacancy}>
                View Fit/Gap Report →
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
