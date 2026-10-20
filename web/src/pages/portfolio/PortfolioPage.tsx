import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, BarChart3, CheckCircle2, Download, FileText, Loader2, RefreshCw, Sparkles, Users, Zap } from "lucide-react";
import { showRequestError } from "@/lib/requestToast";
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
  const requestErrorNotifiedRef = useRef(false);
  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await sessionsApi.getPortfolio(Number(sessionId));
      const data = res.data as any;
      if (data.status === "generating" || data.portfolio?.generation_status === "generating" || data.portfolio?.generation_status === "pending") {
        setGenerating(true);
      } else if (data.portfolio) {
        requestErrorNotifiedRef.current = false;
        setPortfolio(data.portfolio);
        setGenerating(false);
        const overrideMap: Record<number, AssessorOverride> = {};
        data.portfolio.overrides.forEach((o: AssessorOverride) => {
          overrideMap[o.portfolio_skill_id] = o;
        });
        setOverrides(overrideMap);
      }
    } catch (error) {
      if (!requestErrorNotifiedRef.current) {
        showRequestError(error, "Couldn’t load the portfolio.");
        requestErrorNotifiedRef.current = true;
      }
    }
  }, [sessionId]);

  useEffect(() => {
    Promise.all([fetchPortfolio(), vacanciesApi.list(), sessionsApi.get(Number(sessionId))])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data.vacancies);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch((error) => showRequestError(error, "Couldn’t load portfolio resources."))
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
    } catch (error) {
      showRequestError(error, `Couldn’t export ${format.toUpperCase()} portfolio.`);
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

  const skills = portfolio?.skills ?? [];
  const configuredSkills = skills.filter((skill) => !skill.is_discovered);
  const discoveredSkills = skills.filter((skill) => skill.is_discovered);
  const assessedCount = skills.filter((skill) => skill.ai_level > 0).length;
  const lowConfidenceCount = skills.filter((skill) => skill.ai_confidence.toLowerCase() === "low").length;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Link
            to={`/assessments/${id}/invite`}
            aria-label="Back to assessment"
            className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                <Sparkles className="mr-1.5 h-3 w-3" />
                AI assessment
              </Badge>
              {portfolio?.generation_status === "complete" && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  Ready to review
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Candidate portfolio</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {candidateName ?? "Interview candidate"} · Session #{sessionId}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 md:justify-end">
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <FileText className="h-4 w-4" />
            Transcript
          </Link>
          {!generating && portfolio && (
            <>
              <Button variant="outline" size="sm" className="h-10" onClick={() => handleExport("pdf")} disabled={!!exporting}>
                {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                PDF
              </Button>
              <Button variant="outline" size="sm" className="h-10" onClick={() => handleExport("json")} disabled={!!exporting}>
                {exporting === "json" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {generating && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 sm:p-10">
          <div className="mx-auto flex max-w-lg flex-col items-center text-center">
            <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
            </span>
            <p className="font-semibold">Generating portfolio</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The AI is analyzing the interview transcript. This usually takes about two minutes.
            </p>
          </div>
        </div>
      )}

      {!generating && portfolio?.generation_status === "failed" && (
        <div className="flex flex-col gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-destructive">Portfolio generation failed.</p>
            <p className="mt-1 text-sm text-muted-foreground">Retry the analysis when the interview data is available.</p>
          </div>
          <Button variant="outline" onClick={async () => {
            await sessionsApi.regeneratePortfolio(Number(sessionId));
            setGenerating(true);
          }}>
            <RefreshCw className="h-4 w-4" />
            Retry generation
          </Button>
        </div>
      )}

      {!generating && portfolio?.generation_status === "complete" && (
        <>
          <section className="overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-secondary/10 shadow-sm">
            <div className="border-b border-border/70 px-5 py-5 sm:px-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Assessment overview</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight">Evidence, skills, and reviewer signals</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  {portfolio.generated_at ? `Generated ${new Date(portfolio.generated_at).toLocaleDateString()}` : "Generated from interview evidence"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-border/60 sm:grid-cols-4 sm:divide-y-0">
              <div className="p-5 sm:p-6">
                <div className="mb-3 flex items-center gap-2 text-muted-foreground"><BarChart3 className="h-4 w-4" /><span className="text-xs font-medium">Total skills</span></div>
                <p className="text-2xl font-semibold tracking-tight">{skills.length}</p>
              </div>
              <div className="p-5 sm:p-6">
                <div className="mb-3 flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="h-4 w-4" /><span className="text-xs font-medium">Assessed</span></div>
                <p className="text-2xl font-semibold tracking-tight">{assessedCount}</p>
              </div>
              <div className="p-5 sm:p-6">
                <div className="mb-3 flex items-center gap-2 text-muted-foreground"><Zap className="h-4 w-4" /><span className="text-xs font-medium">Discovered</span></div>
                <p className="text-2xl font-semibold tracking-tight">{discoveredSkills.length}</p>
              </div>
              <div className="p-5 sm:p-6">
                <div className="mb-3 flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /><span className="text-xs font-medium">Low confidence</span></div>
                <p className="text-2xl font-semibold tracking-tight">{lowConfidenceCount}</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Configured scope</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">Assessed skills</h2>
              </div>
              <span className="text-sm text-muted-foreground">{configuredSkills.length} skill{configuredSkills.length === 1 ? "" : "s"}</span>
            </div>
            <div className="grid min-w-0 gap-4">
              {configuredSkills.map((skill) => (
                <SkillPortfolioCard
                  key={skill.id}
                  skill={skill}
                  override={overrides[skill.id]}
                  onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                />
              ))}
            </div>
          </section>

          {discoveredSkills.length > 0 && (
            <>
              <Separator />
              <section className="space-y-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary/25 text-secondary-foreground"><Zap className="h-4 w-4" /></span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Beyond the configured scope</p>
                        <h2 className="mt-1 text-xl font-semibold tracking-tight">Discovered skills</h2>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">Skills the AI probed that were not in the original assessment.</p>
                  </div>
                  <Badge variant="secondary" className="hidden sm:inline-flex">{discoveredSkills.length}</Badge>
                </div>
                <div className="grid min-w-0 gap-4">
                  {discoveredSkills.map((skill) => (
                    <SkillPortfolioCard
                      key={skill.id}
                      skill={skill}
                      override={overrides[skill.id]}
                      onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                    />
                  ))}
                </div>
              </section>
            </>
          )}

          <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><BarChart3 className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Next review</p>
                  <h2 className="mt-1 text-lg font-semibold">Compare this portfolio to a vacancy</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Choose a role to generate the fit/gap analysis.</p>
                </div>
              </div>
              <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                  <SelectTrigger className="h-11 w-full sm:w-72">
                    <SelectValue placeholder="Choose vacancy..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vacancies.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>{v.role_title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="h-11 shrink-0" onClick={handleRunFitGap} disabled={!selectedVacancy}>
                  Run Fit/Gap Report
                  <ArrowLeft className="h-4 w-4 rotate-180" />
                </Button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
