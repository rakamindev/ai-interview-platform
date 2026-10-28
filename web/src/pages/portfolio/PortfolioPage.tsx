import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import PortfolioSummary from "@/components/portfolio/PortfolioSummary";
import StatePanel from "@/components/portfolio/StatePanel";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { portfoliosApi } from "@/services/portfolios";
import { usePolling } from "@/hooks/usePolling";
import { summarizePortfolio } from "@/lib/portfolio";
import { ArrowLeft, Download, FileText, Loader2, RefreshCw, TriangleAlert, Zap } from "lucide-react";
import type { Portfolio, AssessorOverride, Vacancy } from "@/types";

/** After this long, tell the assessor generation is slower than usual. */
const SLOW_AFTER_MS = 4 * 60 * 1000;
/** Matches the API's stale-claim window; after this the assessor can restart it. */
const STUCK_AFTER_MS = 10 * 60 * 1000;

type LoadState = "loading" | "error" | "ready";

function sinceMs(iso?: string | null) {
  return iso ? Date.now() - new Date(iso).getTime() : 0;
}

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const [load, setLoad] = useState<LoadState>("loading");
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [generating, setGenerating] = useState(false);
  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [candidateName, setCandidateName] = useState<string | null>(null);

  const transcriptPath = `/assessments/${id}/sessions/${sessionId}/transcript`;

  const fetchPortfolio = useCallback(async () => {
    const res = await sessionsApi.getPortfolio(Number(sessionId));
    const data = res.data as { status?: string; portfolio?: Portfolio };
    const status = data.portfolio?.generation_status;

    if (data.status === "generating" || status === "generating" || status === "pending") {
      setGenerating(true);
      if (data.portfolio) setPortfolio(data.portfolio);
      return;
    }
    if (data.portfolio) {
      setPortfolio(data.portfolio);
      setGenerating(false);
      setOverrides(Object.fromEntries(data.portfolio.overrides.map((o) => [o.portfolio_skill_id, o])));
    }
  }, [sessionId]);

  const loadPage = useCallback(() => {
    setLoad("loading");
    Promise.all([fetchPortfolio(), sessionsApi.get(Number(sessionId))])
      .then(([, sRes]) => {
        setCandidateName(sRes.data.session.candidate_name ?? null);
        setLoad("ready");
      })
      .catch(() => setLoad("error"));
    // The vacancy list only feeds the fit/gap picker; failing it must not hide results.
    vacanciesApi.list().then((r) => setVacancies(r.data.vacancies)).catch(() => setVacancies([]));
  }, [fetchPortfolio, sessionId]);

  useEffect(loadPage, [loadPage]);

  usePolling(() => fetchPortfolio().catch(() => undefined), 5000, generating);

  const handleRetry = async () => {
    setRetrying(true);
    setActionError(null);
    try {
      await sessionsApi.regeneratePortfolio(Number(sessionId));
      setGenerating(true);
    } catch (e: any) {
      setActionError(e?.response?.data?.errors?.[0]?.message ?? "Couldn't restart generation. Try again in a moment.");
    } finally {
      setRetrying(false);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    setActionError(null);
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
    } catch {
      setActionError(`Couldn't export the ${format.toUpperCase()}. Try again.`);
    } finally {
      setExporting(null);
    }
  };

  const ready = !generating && portfolio?.generation_status === "complete";
  const configured = useMemo(() => portfolio?.skills.filter((s) => !s.is_discovered) ?? [], [portfolio]);
  const discovered = useMemo(() => portfolio?.skills.filter((s) => s.is_discovered) ?? [], [portfolio]);
  const summary = useMemo(() => summarizePortfolio(portfolio?.skills ?? [], overrides), [portfolio, overrides]);
  const elapsed = sinceMs(portfolio?.generation_started_at);

  if (load === "loading") {
    return (
      <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  if (load === "error") {
    return (
      <div className="mx-auto max-w-3xl">
        <StatePanel
          tone="error"
          icon={<TriangleAlert className="h-7 w-7" />}
          title="We couldn't load this portfolio"
          action={
            <Button variant="outline" size="sm" onClick={loadPage}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try again
            </Button>
          }
        >
          Check your connection. If the session was deleted or belongs to another workspace, it won't be available.
        </StatePanel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <Link
            to={`/assessments/${id}/invite`}
            className="mt-1 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Back to assessment"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">Skill portfolio</h1>
            {candidateName && <p className="truncate text-sm text-muted-foreground">{candidateName}</p>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pl-6 sm:pl-0">
          <Button variant="outline" size="sm" asChild>
            <Link to={transcriptPath}>
              <FileText className="mr-1 h-3.5 w-3.5" /> Transcript
            </Link>
          </Button>
          {ready && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={!!exporting}>
                {exporting === "pdf" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("json")} disabled={!!exporting}>
                {exporting === "json" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {actionError && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      )}

      {/* Generating */}
      {generating && (
        <StatePanel
          icon={<Loader2 className="h-7 w-7 animate-spin" />}
          title={elapsed > SLOW_AFTER_MS ? "This is taking longer than usual" : "Building the portfolio…"}
          action={
            elapsed > STUCK_AFTER_MS ? (
              <Button variant="outline" size="sm" onClick={handleRetry} disabled={retrying}>
                {retrying ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                Restart generation
              </Button>
            ) : undefined
          }
        >
          {elapsed > STUCK_AFTER_MS
            ? "Generation seems to have stopped. You can restart it — nothing you entered will be lost."
            : "The AI is reading the full transcript and checking every quote against it. This usually takes about 2 minutes; this page updates on its own."}
        </StatePanel>
      )}

      {/* Failed */}
      {!generating && portfolio?.generation_status === "failed" && (
        <StatePanel
          tone="error"
          icon={<TriangleAlert className="h-7 w-7" />}
          title="The portfolio couldn't be generated"
          action={
            <Button variant="outline" size="sm" onClick={handleRetry} disabled={retrying}>
              {retrying ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Retry
            </Button>
          }
        >
          {portfolio.generation_error ?? "Something went wrong while generating the portfolio."} The transcript is
          saved, so retrying is safe.
        </StatePanel>
      )}

      {/* Ready */}
      {ready && configured.length === 0 && discovered.length === 0 && (
        <StatePanel icon={<FileText className="h-7 w-7" />} title="No skills to show">
          This assessment had no skills configured, so there is nothing to rate.
        </StatePanel>
      )}

      {ready && configured.length > 0 && (
        <>
          <PortfolioSummary summary={summary} />

          <section className="space-y-3" aria-labelledby="configured-heading">
            <h2 id="configured-heading" className="text-sm font-semibold">
              Assessed skills
            </h2>
            {configured.map((skill) => (
              <SkillPortfolioCard
                key={skill.id}
                skill={skill}
                override={overrides[skill.id]}
                transcriptPath={transcriptPath}
                onOverrideSaved={(o) => setOverrides((prev) => ({ ...prev, [skill.id]: o }))}
              />
            ))}
          </section>
        </>
      )}

      {ready && discovered.length > 0 && (
        <section className="space-y-3" aria-labelledby="discovered-heading">
          <div>
            <h2 id="discovered-heading" className="flex items-center gap-1.5 text-sm font-semibold">
              <Zap className="h-4 w-4 text-amber-500" aria-hidden />
              Discovered skills
            </h2>
            <p className="text-xs text-muted-foreground">
              Skills the candidate brought up that were not on the agenda. Usually only briefly explored.
            </p>
          </div>
          {discovered.map((skill) => (
            <SkillPortfolioCard
              key={skill.id}
              skill={skill}
              override={overrides[skill.id]}
              transcriptPath={transcriptPath}
              onOverrideSaved={(o) => setOverrides((prev) => ({ ...prev, [skill.id]: o }))}
            />
          ))}
        </section>
      )}

      {/* Fit/Gap */}
      {ready && configured.length > 0 && (
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="fitgap-heading">
          <h2 id="fitgap-heading" className="text-sm font-semibold">
            Compare against a vacancy
          </h2>
          <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
            Uses your ratings where you've set them. Skills not assessed are shown as such, never as gaps.
          </p>
          {vacancies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No vacancies yet.{" "}
              <Link to="/vacancies/new" className="font-medium text-primary hover:underline">
                Create one
              </Link>{" "}
              to run a fit/gap comparison.
            </p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={selectedVacancy} onValueChange={setSelectedVacancy}>
                <SelectTrigger className="w-full sm:w-72" aria-label="Vacancy">
                  <SelectValue placeholder="Choose a vacancy…" />
                </SelectTrigger>
                <SelectContent>
                  {vacancies.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.role_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => navigate(`/assessments/${id}/sessions/${sessionId}/fitgap/${selectedVacancy}`)}
                disabled={!selectedVacancy}
              >
                Run fit/gap analysis
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
