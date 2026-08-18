import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/shared/EmptyState";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import {
  normalizePortfolioResponse,
  portfolioActionsAllowed,
  type PortfolioViewStatus,
} from "@/utils/portfolioStatus";
import { ArrowLeft, Download, Loader2, RefreshCw, Zap, FileText, ClipboardList } from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [viewStatus, setViewStatus] = useState<PortfolioViewStatus>("generating");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);

  const applyPortfolioPayload = useCallback((data: Parameters<typeof normalizePortfolioResponse>[0]) => {
    const view = normalizePortfolioResponse(data);
    setViewStatus(view.status);
    setPortfolio(view.portfolio);
    setErrorMessage(view.errorMessage);

    if (view.portfolio?.overrides) {
      const overrideMap: Record<number, AssessorOverride> = {};
      view.portfolio.overrides.forEach((o) => {
        overrideMap[o.portfolio_skill_id] = o;
      });
      setOverrides(overrideMap);
    } else {
      setOverrides({});
    }
  }, []);

  const fetchPortfolio = useCallback(async () => {
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    applyPortfolioPayload(res.data);
  }, [sessionId, applyPortfolioPayload]);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([fetchPortfolio(), vacanciesApi.list(), sessionsApi.get(Number(sessionId))])
      .then(([, vRes, sRes]) => {
        setVacancies(vRes.data.vacancies);
        setCandidateName(sRes.data.session.candidate_name ?? null);
      })
      .catch(() => {
        setViewStatus("empty");
        setErrorMessage("Failed to load portfolio. Refresh the page and try again.");
      })
      .finally(() => setLoading(false));
  }, [fetchPortfolio, sessionId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const isGenerating = viewStatus === "generating";
  const isComplete = viewStatus === "complete" && !!portfolio;
  const isFailed = viewStatus === "failed";
  const { canExport, canRetry } = portfolioActionsAllowed(viewStatus, portfolio);

  usePolling(fetchPortfolio, 5000, isGenerating && !loading);

  const handleOverrideSaved = (skillId: number, override: AssessorOverride) => {
    setOverrides((prev) => ({ ...prev, [skillId]: override }));
  };

  const handleRetry = async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      await sessionsApi.regeneratePortfolio(Number(sessionId));
      setViewStatus("generating");
      setErrorMessage(null);
      await fetchPortfolio();
    } catch (e: any) {
      setRetryError(
        e?.response?.data?.errors?.[0]?.message ??
        "Retry failed. Portfolio can only be regenerated when status is failed."
      );
    } finally {
      setRetrying(false);
    }
  };

  const handleRunFitGap = () => {
    if (!selectedVacancy || !isComplete) return;
    navigate(`/assessments/${id}/sessions/${sessionId}/fitgap/${selectedVacancy}`);
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio || !isComplete) return;
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
      <div className="max-w-5xl space-y-6">
        <LoadingBlock rows={3} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        breadcrumb={
          <Link
            to={`/assessments/${id}/invite`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to assessment
          </Link>
        }
        title="Portfolio Results"
        description={candidateName ?? undefined}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/assessments/${id}/sessions/${sessionId}/transcript`}>
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Transcript
              </Link>
            </Button>
            {canExport && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("pdf")}
                  disabled={!!exporting}
                >
                  {exporting === "pdf" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1" />
                  )}
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("json")}
                  disabled={!!exporting}
                >
                  {exporting === "json" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1" />
                  )}
                  JSON
                </Button>
              </>
            )}
          </>
        }
      />

      {isGenerating && (
        <div className="rounded-xl border bg-muted/20 px-6 py-12 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <div>
            <p className="font-medium text-sm">Generating portfolio...</p>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
              The AI is analyzing the interview transcript. This usually takes about 2 minutes.
              Export and fit-gap stay disabled until generation completes.
            </p>
          </div>
        </div>
      )}

      {isFailed && (
        <div className="space-y-3">
          <ErrorState
            title="Portfolio generation failed"
            description={errorMessage ?? undefined}
            onRetry={canRetry ? handleRetry : undefined}
          />
          <p className="text-xs text-center text-muted-foreground">
            Do not use these results for hiring decisions until generation succeeds.
          </p>
          {retryError && (
            <p className="text-xs text-destructive text-center break-anywhere">{retryError}</p>
          )}
        </div>
      )}

      {viewStatus === "empty" && (
        <EmptyState
          icon={ClipboardList}
          title="Portfolio not ready"
          description={errorMessage ?? undefined}
          action={
            <Button variant="outline" size="sm" onClick={reload}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
          }
        />
      )}

      {isComplete && portfolio && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="shadow-none">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Configured skills
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {portfolio.skills.filter((s) => !s.is_discovered).length}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Original assessment skills rated by AI and assessor.
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Human overrides
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {Object.keys(overrides).length}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Final assessor adjustments applied to hiring signal.
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Discovered skills
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {portfolio.skills.filter((s) => s.is_discovered).length}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Skills surfaced by the AI outside the original brief.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold">Configured Skills</h2>
              <p className="text-xs text-muted-foreground">
                Final level = assessor override when present; otherwise AI rating.
              </p>
            </div>
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

          <Card className="shadow-none">
            <CardContent className="p-4 space-y-3">
              <div>
                <h2 className="text-sm font-semibold">Compare against a vacancy</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Run fit/gap after portfolio review to compare final skill levels against role expectations.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Choose vacancy..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vacancies.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        <span className="break-anywhere">{v.role_title}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleRunFitGap} disabled={!selectedVacancy} className="shrink-0">
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
