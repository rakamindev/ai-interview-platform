import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import Breadcrumb from "@/components/layout/Breadcrumb";
import Page from "@/components/layout/Page";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, ArrowRight, Download, FileText, Loader2, RefreshCw } from "lucide-react";
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
  const [loadFailed, setLoadFailed] = useState(false);

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

  // Swallowing this used to render the "no portfolio yet" empty state, which
  // tells an assessor the AI has not finished — when in fact the request
  // failed and the portfolio may well exist. The two lead to opposite actions.
  const load = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    Promise.all([fetchPortfolio(), vacanciesApi.list(), sessionsApi.get(Number(sessionId))])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data.vacancies);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  useEffect(load, [load]);

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
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <Page width="document" className="space-y-4" data-testid="portfolio-page-skeleton">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </Page>
    );
  }

  if (loadFailed) {
    return (
      <Page width="document" className="space-y-4" data-testid="portfolio-load-failed">
        <div className="flex items-center gap-2">
          <Link to={`/assessments/${id}/invite`} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-semibold">Couldn't load these results</h1>
        </div>
        <div className="rounded-lg border border-destructive/40 p-5">
          <p className="text-sm">
            The request failed, so this page cannot tell you whether a portfolio exists for
            this session. This is not the same as the AI having found nothing.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try again
            </Button>
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/transcript`}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              <FileText className="h-3.5 w-3.5" /> Open transcript
            </Link>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page width="document" className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 space-y-1.5">
          <Breadcrumb
            crumbs={[
              { label: "Assessments", to: "/assessments" },
              { label: "Candidates", to: `/assessments/${id}/invite` },
              { label: candidateName ?? "Candidate" },
              { label: "Portfolio" },
            ]}
          />
          <h1 className="text-lg font-semibold">Portfolio Results</h1>
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

      {/* Generating state — skeletons mirror the card layout, with an estimate */}
      {generating && (
        <div className="space-y-3" data-testid="portfolio-generating">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-52" />
                  <Skeleton className="h-2.5 w-40" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
              <Skeleton className="h-2.5 w-full" />
              <Skeleton className="h-2.5 w-4/5" />
            </div>
          ))}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            The AI is analyzing the interview transcript. This takes about 2 minutes.
          </div>
        </div>
      )}

      {/* Failed state — plain language, no raw provider error, partial data stays visible */}
      {!generating && portfolio?.generation_status === "failed" && (
        <div className="space-y-4" data-testid="portfolio-failed">
          <div className="rounded-lg border border-destructive/40 p-5">
            <p className="font-medium">The AI couldn't finish analyzing this interview.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The interview and its transcript are unaffected. You can try again.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={async () => {
                await sessionsApi.regeneratePortfolio(Number(sessionId));
                setGenerating(true);
              }}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try again
            </Button>
          </div>
          {portfolio.skills.length > 0 && (
            <SkillPortfolioCard
              skill={portfolio.skills[0]}
              override={overrides[portfolio.skills[0].id]}
              onOverrideSaved={(o) => handleOverrideSaved(portfolio.skills[0].id, o)}
            />
          )}
        </div>
      )}

      {/* Empty state — nothing to review yet, one clear next action */}
      {!generating && !portfolio && (
        <div className="rounded-lg border p-10 text-center" data-testid="portfolio-empty">
          <p className="font-medium">No skill portfolio yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            The AI builds this after an interview ends. It takes about two minutes — come
            back shortly, or open the transcript to review the conversation now.
          </p>
          <Link
            to={`/assessments/${id}/sessions/${sessionId}/transcript`}
            className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Open transcript <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Ready state */}
      {!generating && portfolio?.generation_status === "complete" && (
        <>
          {/* Comparing this candidate against a role is the decision this page
              feeds, so it sits above the evidence rather than below all of it.
              It used to be the last control on a page several screens long. */}
          <div
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3"
            data-testid="fitgap-launcher"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Compare against a role</p>
              <p className="text-xs text-muted-foreground">
                {vacancies.length === 0
                  ? "No vacancies yet — create one to run a fit/gap analysis."
                  : "See where this candidate meets, exceeds, or falls short of the requirements."}
              </p>
            </div>
            {vacancies.length === 0 ? (
              <Link
                to="/vacancies/new"
                className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                New vacancy <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                  <SelectTrigger className="w-52">
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
                  Run fit/gap
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Configured skills */}
          <div className="space-y-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Configured skills
            </span>
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
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Discovered skills
                  </span>
                  <p className="mt-0.5 text-xs text-muted-foreground">
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

        </>
      )}
    </Page>
  );
}
