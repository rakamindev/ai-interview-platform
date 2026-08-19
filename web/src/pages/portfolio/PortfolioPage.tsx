import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PortfolioPanel from "@/components/portfolio/PortfolioPanel";
import CompareCandidatePicker from "@/components/portfolio/CompareCandidatePicker";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { ArrowLeft, Columns2, Download, FileText, Loader2, RefreshCw, X } from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy, Candidate } from "@/types";

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
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareEntered, setCompareEntered] = useState(false);
  const [compareCandidate, setCompareCandidate] = useState<Candidate | null>(null);
  const [comparePortfolio, setComparePortfolio] = useState<Portfolio | null>(null);
  const [compareOverrides, setCompareOverrides] = useState<Record<number, AssessorOverride>>({});
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState(false);

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

  // Entrance transition for the compare panel — mount off-screen, then
  // flip the transform/opacity classes a tick later so CSS transitions run.
  useEffect(() => {
    if (compareOpen) {
      const timer = setTimeout(() => setCompareEntered(true), 20);
      return () => clearTimeout(timer);
    }
  }, [compareOpen]);

  const toggleCompare = () => {
    if (compareOpen) {
      setCompareOpen(false);
      setCompareEntered(false);
      setCompareCandidate(null);
      setComparePortfolio(null);
      setCompareOverrides({});
      setCompareError(false);
    } else {
      setCompareOpen(true);
    }
  };

  const handleSelectCompareCandidate = async (candidate: Candidate) => {
    setCompareCandidate(candidate);
    setComparePortfolio(null);
    setCompareOverrides({});
    setCompareLoading(true);
    setCompareError(false);
    try {
      const res = await sessionsApi.getPortfolio(candidate.session_id);
      const data = res.data as any;
      if (data.portfolio) {
        setComparePortfolio(data.portfolio);
        const overrideMap: Record<number, AssessorOverride> = {};
        data.portfolio.overrides.forEach((o: AssessorOverride) => {
          overrideMap[o.portfolio_skill_id] = o;
        });
        setCompareOverrides(overrideMap);
      } else {
        setCompareError(true);
      }
    } catch {
      setCompareError(true);
    } finally {
      setCompareLoading(false);
    }
  };

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
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div
      className={`mx-auto space-y-8 pb-12 transition-[max-width] duration-300 ${
        compareOpen ? "max-w-7xl" : "max-w-2xl"
      }`}
    >
      {/* Header */}
      <div className="-mx-4 sm:mx-0 sm:rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b sm:border sm:border-primary/10 px-4 sm:px-6 py-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to={`/assessments/${id}/invite`}
              className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Portfolio Results</h1>
              {candidateName && (
                <p className="text-sm text-muted-foreground mt-0.5">{candidateName}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 shrink-0">
            <Link
              to={`/assessments/${id}/sessions/${sessionId}/transcript`}
              aria-label="Transcript"
              className="inline-flex items-center gap-1.5 text-sm border bg-background rounded-md px-2.5 sm:px-3 py-1.5 hover:bg-accent hover:shadow-sm transition-all"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Transcript</span>
            </Link>
            {!generating && portfolio && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Download PDF"
                  className="bg-background px-2.5 sm:px-3"
                  onClick={() => handleExport("pdf")}
                  disabled={!!exporting}
                >
                  {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 sm:mr-1" />}
                  <span className="hidden sm:inline">PDF</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Download JSON"
                  className="bg-background px-2.5 sm:px-3"
                  onClick={() => handleExport("json")}
                  disabled={!!exporting}
                >
                  {exporting === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 sm:mr-1" />}
                  <span className="hidden sm:inline">JSON</span>
                </Button>
                {portfolio.generation_status === "complete" && (
                  <Button
                    variant={compareOpen ? "secondary" : "outline"}
                    size="sm"
                    aria-label={compareOpen ? "Hide compare panel" : "Compare"}
                    className={compareOpen ? "px-2.5 sm:px-3" : "bg-background px-2.5 sm:px-3"}
                    onClick={toggleCompare}
                  >
                    <Columns2 className="h-3.5 w-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">Compare</span>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className={`px-4 sm:px-0 grid gap-6 items-start ${
          compareOpen ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
        }`}
      >
        <div className="min-w-0 space-y-8">
          {/* Generating state */}
          {generating && (
            <div className="border rounded-2xl p-12 text-center space-y-4 bg-gradient-to-b from-primary/5 to-transparent">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <div>
                <p className="font-semibold">Generating portfolio…</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                  The AI is analyzing the interview transcript. This takes about 2 minutes.
                </p>
              </div>
            </div>
          )}

          {/* Failed state */}
          {!generating && portfolio?.generation_status === "failed" && (
            <div className="border border-destructive/30 bg-destructive/5 rounded-2xl p-8 text-center space-y-4">
              <p className="text-sm font-medium text-destructive">Portfolio generation failed.</p>
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
              <PortfolioPanel
                portfolio={portfolio}
                overrides={overrides}
                transcriptHref={`/assessments/${id}/sessions/${sessionId}/transcript`}
                onOverrideSaved={handleOverrideSaved}
              />

              <Separator />

              {/* Fit/Gap */}
              <div className="rounded-2xl border bg-gradient-to-br from-primary/5 to-transparent p-5 space-y-3">
                <div>
                  <h2 className="text-sm font-semibold">Run a Fit/Gap Analysis</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Compare this candidate against a vacancy's requirements.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                    <SelectTrigger className="w-56 bg-background">
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
              </div>
            </>
          )}
        </div>

        {compareOpen && (
          <div
            className={`min-w-0 rounded-2xl border bg-card p-4 transition-all duration-300 ease-out ${
              compareEntered ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Comparing
              </span>
              <button
                onClick={toggleCompare}
                aria-label="Close compare"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!compareCandidate ? (
              <CompareCandidatePicker
                assessmentId={Number(id)}
                excludeSessionId={Number(sessionId)}
                onSelect={handleSelectCompareCandidate}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{compareCandidate.candidate_name || `Candidate ${compareCandidate.candidate_id}`}</p>
                  <button
                    onClick={() => setCompareCandidate(null)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Change
                  </button>
                </div>

                {compareLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : compareError ? (
                  <p className="text-xs text-destructive text-center py-8">
                    Couldn't load this candidate's portfolio.
                  </p>
                ) : comparePortfolio ? (
                  <PortfolioPanel
                    portfolio={comparePortfolio}
                    overrides={compareOverrides}
                    transcriptHref={`/assessments/${id}/sessions/${compareCandidate.session_id}/transcript`}
                    readOnly
                  />
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
