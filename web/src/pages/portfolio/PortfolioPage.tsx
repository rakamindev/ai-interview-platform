import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import PrivacyBadge from "@/components/common/PrivacyBadge";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { assessmentsApi } from "@/services/assessments";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Zap,
  FileText,
  Search,
  AlertTriangle,
  Award,
  Sparkles,
  CheckCircle2,
  ShieldCheck
} from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy, Assessment } from "@/types";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [skillFilter, setSkillFilter] = useState<"all" | "configured" | "discovered">("all");

  const fetchPortfolio = useCallback(async () => {
    try {
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
        (data.portfolio.overrides || []).forEach((o: AssessorOverride) => {
          overrideMap[o.portfolio_skill_id] = o;
        });
        setOverrides(overrideMap);
      }
    } catch {
      // ignore
    }
  }, [sessionId]);

  useEffect(() => {
    Promise.all([
      fetchPortfolio(),
      vacanciesApi.list(),
      sessionsApi.get(Number(sessionId)),
      id ? assessmentsApi.get(Number(id)) : Promise.resolve(null),
    ])
      .then(([, vRes, sRes, aRes]) => {
        setVacancies(vRes.data.vacancies || []);
        setCandidateName(sRes.data.session?.candidate_name ?? null);
        if (aRes?.data?.assessment) {
          setAssessment(aRes.data.assessment);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId, id]);

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
        a.download = `portfolio-session-${sessionId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `portfolio-session-${sessionId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(null);
    }
  };

  // Find unassessed skills from assessment that are not present in the generated portfolio
  const unassessedSkills = useMemo(() => {
    if (!assessment?.skills || !portfolio?.skills) return [];
    const assessedLabels = new Set(
      portfolio.skills.map((s) => s.skill_label.trim().toLowerCase())
    );
    return assessment.skills.filter(
      (askill) => !assessedLabels.has(askill.skill_label.trim().toLowerCase())
    );
  }, [assessment, portfolio]);

  const filteredSkills = useMemo(() => {
    if (!portfolio?.skills) return [];
    return portfolio.skills.filter((s) => {
      const matchesQuery = s.skill_label.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesQuery) return false;
      if (skillFilter === "configured") return !s.is_discovered;
      if (skillFilter === "discovered") return s.is_discovered;
      return true;
    });
  }, [portfolio, searchQuery, skillFilter]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-5 pb-12">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            to={`/assessments/${id}/invite`}
            className="mt-1 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Candidate Assessment Portfolio
              </h1>
              <PrivacyBadge />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span className="font-semibold text-foreground">
                {candidateName || `Session #${sessionId}`}
              </span>
              <span>·</span>
              <span>{assessment?.name || "Skill Evaluation"}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex items-center gap-1.5 text-xs font-medium border rounded-lg px-3 py-1.5 hover:bg-accent transition-colors shadow-2xs"
          >
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            Transcript
          </Link>
          {!generating && portfolio && portfolio.generation_status === "complete" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("pdf")}
                disabled={!!exporting}
                className="h-8 text-xs font-medium"
              >
                {exporting === "pdf" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                )}
                PDF Report
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
                disabled={!!exporting}
                className="h-8 text-xs font-medium"
              >
                {exporting === "json" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                )}
                JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {/* UU PDP Compliance Notice Banner */}
      <PrivacyBadge variant="banner" />

      {/* Generating state */}
      {generating && (
        <div className="border rounded-2xl p-12 text-center space-y-4 bg-muted/10 shadow-xs">
          <div className="relative mx-auto w-12 h-12 flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-base text-foreground">Synthesizing Competency Portfolio...</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Google Gemini Pro is processing the anonymized interview transcripts against L1–L5 behavioral anchors. This typically concludes within 60–90 seconds.
            </p>
          </div>
        </div>
      )}

      {/* Failed state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <div className="border border-destructive/40 bg-destructive/5 rounded-2xl p-8 text-center space-y-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10 text-destructive mx-auto">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-destructive">Evaluation Generation Incomplete</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              {portfolio.generation_error || "The AI evaluator timed out or encountered rate limits during synthesis."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await sessionsApi.regeneratePortfolio(Number(sessionId));
              setGenerating(true);
            }}
            className="text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Re-trigger Synthesis
          </Button>
        </div>
      )}

      {/* Ready state */}
      {!generating && portfolio?.generation_status === "complete" && (
        <>
          {/* Unassessed Skills Alert & Chips */}
          {unassessedSkills.length > 0 && (
            <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 dark:bg-amber-950/20 p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Unassessed / Pending Skills ({unassessedSkills.length})
                </h3>
              </div>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                The interview dialogue did not cover sufficient scope to evaluate these planned competencies:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {unassessedSkills.map((s) => (
                  <span
                    key={s.id ?? s.skill_label}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300/80 dark:bg-amber-900/60 dark:text-amber-200"
                  >
                    <span>{s.skill_label}</span>
                    <span className="text-[10px] text-amber-700 dark:text-amber-400">
                      (Exp: L{s.expected_level})
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search evaluated skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <div className="flex gap-1 bg-muted/60 p-0.5 rounded-lg border text-xs">
              <button
                onClick={() => setSkillFilter("all")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  skillFilter === "all" ? "bg-background shadow-2xs font-bold text-foreground" : "text-muted-foreground"
                }`}
              >
                All ({portfolio.skills.length})
              </button>
              <button
                onClick={() => setSkillFilter("configured")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  skillFilter === "configured" ? "bg-background shadow-2xs font-bold text-foreground" : "text-muted-foreground"
                }`}
              >
                Configured ({portfolio.skills.filter((s) => !s.is_discovered).length})
              </button>
              <button
                onClick={() => setSkillFilter("discovered")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  skillFilter === "discovered" ? "bg-background shadow-2xs font-bold text-amber-600" : "text-muted-foreground"
                }`}
              >
                Discovered ({portfolio.skills.filter((s) => s.is_discovered).length})
              </button>
            </div>
          </div>

          {/* Skills List */}
          <div className="space-y-3">
            {filteredSkills.length === 0 ? (
              <div className="border border-dashed rounded-xl p-8 text-center text-xs text-muted-foreground">
                No evaluated skills match your search query.
              </div>
            ) : (
              filteredSkills.map((skill) => (
                <SkillPortfolioCard
                  key={skill.id}
                  skill={skill}
                  override={overrides[skill.id]}
                  onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                />
              ))
            )}
          </div>

          <Separator />

          {/* Fit/Gap Action Section */}
          <div className="rounded-2xl border bg-card/60 p-5 space-y-3 shadow-xs">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Award className="h-4 w-4 text-primary" />
                Benchmark Against Role Vacancy (Fit/Gap)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Compare this candidate's validated competencies against specific job requirements and company culture standards.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                <SelectTrigger className="w-full sm:w-72 h-9 text-xs">
                  <SelectValue placeholder="Select target role / vacancy..." />
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
                className="h-9 text-xs font-semibold shadow-xs"
              >
                Run Fit/Gap Analysis →
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
