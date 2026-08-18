import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import {
  ArrowLeft, Download, Loader2, RefreshCw, Zap,
  FileText, AlertTriangle, CheckCircle2, TrendingUp,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";

// ── Confidence summary pill ───────────────────────────────────────────────
function ConfidenceSummary({ portfolio }: { portfolio: Portfolio }) {
  const skills = portfolio.skills.filter((s) => !s.is_discovered);
  const high = skills.filter((s) => s.ai_confidence === "high").length;
  const medium = skills.filter((s) => s.ai_confidence === "medium").length;
  const low = skills.filter((s) => s.ai_confidence === "low").length;

  if (skills.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {high > 0 && (
        <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          {high} high confidence
        </span>
      )}
      {medium > 0 && (
        <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          {medium} medium
        </span>
      )}
      {low > 0 && (
        <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
          {low} low — warrants follow-up
        </span>
      )}
    </div>
  );
}

// ── Vacancy preview card for fit/gap selection ────────────────────────────
function VacancyPreview({ vacancy }: { vacancy: Vacancy }) {
  const skills = vacancy.skills ?? [];
  return (
    <div className="text-xs text-muted-foreground space-y-1 mt-1.5">
      {skills.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {skills.slice(0, 4).map((s) => (
            <span key={s.skill_label} className="bg-muted px-1.5 py-0.5 rounded">
              {s.skill_label}
            </span>
          ))}
          {vacancy.skills.length > 4 && (
            <span className="text-muted-foreground">+{skills.length - 4} more</span>
          )}
        </span>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);

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
      const map: Record<number, AssessorOverride> = {};
      data.portfolio.overrides.forEach((o: AssessorOverride) => {
        map[o.portfolio_skill_id] = o;
      });
      setOverrides(map);
    }
  }, [sessionId]);

  useEffect(() => {
    Promise.all([
      fetchPortfolio(),
      vacanciesApi.list(),
      sessionsApi.get(Number(sessionId)),
    ])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data.vacancies);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch(() => setError("Failed to load portfolio data."))
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
      const blob =
        format === "json"
          ? new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" })
          : new Blob([res.data as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portfolio-${sessionId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  };

  // ── Skeleton ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const configuredSkills = portfolio?.skills.filter((s) => !s.is_discovered) ?? [];
  const discoveredSkills = portfolio?.skills.filter((s) => s.is_discovered) ?? [];
  const selectedVacancyObj = vacancies.find((v) => String(v.id) === selectedVacancy);
  const overrideCount = Object.keys(overrides).length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to={`/assessments/${id}/invite`}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">Portfolio Results</h1>
            {candidateName && (
              <p className="text-sm text-muted-foreground truncate">{candidateName}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex items-center gap-1.5 text-sm border rounded-md px-3 py-1.5 hover:bg-accent transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Transcript
          </Link>
          {!generating && portfolio?.generation_status === "complete" && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting}>
                {exporting === "pdf"
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5 mr-1" />}
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!!exporting}>
                {exporting === "json"
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5 mr-1" />}
                JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* ── Generating ───────────────────────────────────────────────────────── */}
      {generating && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <div className="relative mx-auto w-12 h-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary/20 absolute inset-0" />
              <BarChart3 className="h-5 w-5 text-primary absolute inset-0 m-auto" />
            </div>
            <div>
              <p className="font-medium">Generating portfolio…</p>
              <p className="text-sm text-muted-foreground mt-1">
                AI is analyzing the interview transcript. This takes about 2 minutes.
              </p>
            </div>
            <div className="flex justify-center gap-1">
              {[0, 0.3, 0.6].map((d) => (
                <span
                  key={d}
                  className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${d}s` }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Failed ───────────────────────────────────────────────────────────── */}
      {!generating && portfolio?.generation_status === "failed" && (
        <Card className="border-destructive/40">
          <CardContent className="py-8 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
            <div>
              <p className="font-medium text-destructive">Portfolio generation failed</p>
              {portfolio.generation_error && (
                <p className="text-xs text-muted-foreground mt-1 font-mono">
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
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry generation
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Complete ─────────────────────────────────────────────────────────── */}
      {!generating && portfolio?.generation_status === "complete" && (
        <>
          {/* Summary strip */}
          <Card className="bg-muted/30">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">
                      {configuredSkills.length} skill{configuredSkills.length !== 1 ? "s" : ""} assessed
                      {overrideCount > 0 && (
                        <span className="text-muted-foreground font-normal ml-1.5">
                          · {overrideCount} human override{overrideCount !== 1 ? "s" : ""} applied
                        </span>
                      )}
                      {discoveredSkills.length > 0 && (
                        <span className="text-amber-600 font-normal ml-1.5">
                          · {discoveredSkills.length} discovered
                        </span>
                      )}
                    </p>
                    <ConfidenceSummary portfolio={portfolio} />
                  </div>
                </div>
                {portfolio.generated_at && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    Generated {new Date(portfolio.generated_at).toLocaleString()}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Configured skills */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Configured Skills
            </h2>
            {configuredSkills.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No configured skills found.</p>
            ) : (
              configuredSkills.map((skill) => (
                <SkillPortfolioCard
                  key={skill.id}
                  skill={skill}
                  override={overrides[skill.id]}
                  onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                />
              ))
            )}
          </div>

          {/* Discovered skills */}
          {discoveredSkills.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Discovered Skills
                    <Badge variant="secondary" className="text-xs font-normal ml-1">
                      {discoveredSkills.length}
                    </Badge>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Skills the AI probed that were not in the original assessment
                  </p>
                </div>
                {discoveredSkills.map((skill) => (
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

          {/* Fit / Gap section */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Run Fit / Gap Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Compare this portfolio against a vacancy to see skill matches, gaps, and exceeds.
              </p>

              <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a vacancy…" />
                </SelectTrigger>
                <SelectContent>
                  {vacancies.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No vacancies found. Create one first.
                    </div>
                  ) : (
                    vacancies.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.role_title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {/* Vacancy preview */}
              {selectedVacancyObj && (
                <VacancyPreview vacancy={selectedVacancyObj} />
              )}

              <Button
                onClick={handleRunFitGap}
                disabled={!selectedVacancy}
                className="w-full"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Run Fit / Gap Analysis →
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
