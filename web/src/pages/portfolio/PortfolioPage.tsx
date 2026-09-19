import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import BadgeDot from "@/components/design/BadgeDot";
import Banner from "@/components/design/Banner";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { extractExportError } from "@/services/api";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, FileText, AlertTriangle } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [retrying, setRetrying] = useState(false);

  const handleRetryRegenerate = async () => {
    setRetrying(true);
    setError(null);
    try {
      await sessionsApi.regeneratePortfolio(Number(sessionId));
      setGenerating(true);
      setPortfolio(null);
    } catch {
      setError("Could not restart portfolio generation. Please try again.");
    } finally {
      setRetrying(false);
    }
  };

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await sessionsApi.getPortfolio(Number(sessionId));
      const data = res.data as any;
      if (data.status === "generating" || data.portfolio?.generation_status === "generating" || data.portfolio?.generation_status === "pending") {
        setGenerating(true);
      } else if (data.portfolio) {
        setError(null);
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
      setError("We couldn't load this portfolio. Please try again.");
    }
  }, [sessionId]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([fetchPortfolio(), vacanciesApi.list(), sessionsApi.get(Number(sessionId))])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data.vacancies);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch(() => setError("We couldn't load this portfolio. Please try again."))
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId, retryKey]);

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
    } catch (e) {
      const message = (await extractExportError(e)) ?? "Could not export the portfolio. Please try again.";
      setError(message);
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-[14px]" />
        <Skeleton className="h-48 w-full rounded-[14px]" />
      </div>
    );
  }

  const configuredSkills = portfolio?.skills.filter((s) => !s.is_discovered) ?? [];
  const discoveredSkills = portfolio?.skills.filter((s) => s.is_discovered) ?? [];
  const hasLowConfidence = portfolio?.skills.some(
    (s) => s.ai_confidence?.toLowerCase() === "low"
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/assessments/${id}/invite`} aria-label="Back to assessment">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
            Portfolio Results
          </h1>
          {candidateName && (
            <p className="mt-0.5 text-sm text-muted-foreground">{candidateName}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/assessments/${id}/sessions/${sessionId}/transcript`}>
              <FileText className="h-3.5 w-3.5" /> Transcript
            </Link>
          </Button>
          {!generating && portfolio && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting}>
                {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!!exporting}>
                {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-xl border border-[#f2c2c2] bg-danger-soft px-4 py-3 text-sm text-[#8f2f2f]"
        >
          <span>{error}</span>
          <Button variant="outline" size="sm" className="shrink-0 bg-white" onClick={() => setRetryKey((k) => k + 1)}>
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </Button>
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div
          role="status"
          aria-live="polite"
          className="space-y-3 rounded-[14px] border border-border bg-card p-12 text-center shadow-sm"
        >
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand" />
          <div>
            <p className="font-semibold text-foreground">Generating portfolio...</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The AI is analyzing the interview transcript. This takes about 2 minutes.
            </p>
          </div>
        </div>
      )}

      {/* Failed state */}
      {!generating && portfolio?.generation_status === "failed" && (
        <div
          role="status"
          aria-live="polite"
          className="space-y-3 rounded-[14px] border border-[#f2c2c2] bg-danger-soft p-6 text-center"
        >
          <p className="text-sm text-[#8f2f2f]">Portfolio generation failed.</p>
          <Button variant="outline" size="sm" className="bg-white" onClick={handleRetryRegenerate} disabled={retrying}>
            {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Retry
          </Button>
        </div>
      )}

      {/* Ready state */}
      {!generating && portfolio?.generation_status === "complete" && (
        <>
          {hasLowConfidence && (
            <Banner tone="warn" icon={<AlertTriangle />}>
              One or more skills have low AI confidence. Review the evidence before making a hiring
              call.
            </Banner>
          )}

          <div className="grid gap-[18px] lg:grid-cols-[1.4fr_1fr] lg:items-start">
            {/* Skills */}
            <div className="space-y-5">
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Configured Skills</h2>
                {configuredSkills.map((skill) => (
                  <SkillPortfolioCard
                    key={skill.id}
                    skill={skill}
                    override={overrides[skill.id]}
                    onOverrideSaved={(o) => handleOverrideSaved(skill.id, o)}
                  />
                ))}
              </div>

              {discoveredSkills.length > 0 && (
                <div className="space-y-3">
                  <div>
                    <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <Zap className="h-4 w-4 text-warn" />
                      Discovered Skills
                    </h2>
                    <p className="text-xs text-muted-foreground">
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
              )}

              {/* Fit/Gap */}
              <div className="rounded-[14px] border border-border bg-card p-5 shadow-sm">
                <div className="font-display text-sm font-semibold text-foreground">
                  Fit/Gap analysis
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Compare this portfolio against a vacancy's competency expectations.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {vacancies.length > 0 ? (
                    <>
                      <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                        <SelectTrigger className="w-full sm:w-56">
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
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No vacancies yet — create one in the Vacancies page to run a fit/gap analysis.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Aside */}
            <aside className="space-y-4">
              <div className="rounded-[14px] border border-border bg-card shadow-sm">
                <div className="px-5 pt-4">
                  <div className="font-display text-sm font-semibold text-foreground">At a glance</div>
                </div>
                <div className="space-y-2.5 px-5 pb-5 pt-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Skills assessed</span>
                    <span className="font-mono">
                      {configuredSkills.length}
                      {discoveredSkills.length > 0 ? ` (+${discoveredSkills.length} discovered)` : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">High confidence</span>
                    <span className="font-mono">
                      {portfolio.skills.filter((s) => s.ai_confidence?.toLowerCase() === "high").length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Medium / Low</span>
                    <span className="font-mono">
                      {portfolio.skills.filter((s) => s.ai_confidence?.toLowerCase() === "medium").length}
                      {" / "}
                      {portfolio.skills.filter((s) => s.ai_confidence?.toLowerCase() === "low").length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-[14px] border border-border bg-card shadow-sm">
                <div className="px-5 pt-4">
                  <div className="font-display text-sm font-semibold text-foreground">
                    Adjusting a level
                  </div>
                </div>
                <div className="px-5 pb-5 pt-2 text-xs text-muted-foreground">
                  Overrides are saved with your name and a note, so the audit trail stays clean. The
                  AI's original level is never erased.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <BadgeDot tone="ok">AI level</BadgeDot>
                <BadgeDot tone="warn">Overridden</BadgeDot>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
