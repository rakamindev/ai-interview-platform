import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { ArrowLeft, Download, History, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import StatePanel from "@/components/StatePanel";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import EvidenceGapsNotice from "@/components/fitgap/EvidenceGapsNotice";
import LevelBadge from "@/components/portfolio/LevelBadge";
import { portfoliosApi } from "@/services/portfolios";
import { sessionsApi } from "@/services/sessions";
import { vacanciesApi } from "@/services/vacancies";
import { usePolling } from "@/hooks/usePolling";
import { downloadFile } from "@/utils/download";
import type { FitGapReport, Portfolio } from "@/types";

export const POLL_INTERVAL_MS = 5_000;
/** A report normally takes seconds; after this the job is treated as lost and the user can retry. */
export const TIMEOUT_MS = 3 * 60_000;

type View =
  | { kind: "loading" }
  | { kind: "load_error" }
  | { kind: "portfolio_not_ready" }
  | { kind: "generating" }
  | { kind: "timed_out" }
  | { kind: "ready"; report: FitGapReport };

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{ id: string; sessionId: string; vacancyId: string }>();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [view, setView] = useState<View>({ kind: "loading" });
  const [roleTitle, setRoleTitle] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [busy, setBusy] = useState<"regenerate" | "export" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const generatingSince = useRef<number | null>(null);
  const portfolioPath = `/assessments/${id}/sessions/${sessionId}/portfolio`;

  const startGenerating = () => {
    generatingSince.current = Date.now();
    setView({ kind: "generating" });
  };

  const fetchReport = useCallback(
    async (target: Portfolio) => {
      try {
        const res = await portfoliosApi.getFitGap(target.id, Number(vacancyId));
        generatingSince.current = null;
        setView({ kind: "ready", report: res.data.report });
      } catch (error) {
        if (!isAxiosError(error) || error.response?.status !== 404) {
          setView((current) => (current.kind === "generating" ? current : { kind: "load_error" }));
          return;
        }
        if (generatingSince.current === null) {
          // No report yet: ask for one once, then poll.
          await portfoliosApi.triggerFitGap(target.id, Number(vacancyId));
          generatingSince.current = Date.now();
        }
        setView(Date.now() - generatingSince.current > TIMEOUT_MS ? { kind: "timed_out" } : { kind: "generating" });
      }
    },
    [vacancyId],
  );

  const load = useCallback(async () => {
    setView({ kind: "loading" });
    try {
      const { data } = await sessionsApi.getPortfolio(Number(sessionId));
      if (!("portfolio" in data) || data.portfolio.generation_status !== "complete") {
        setView({ kind: "portfolio_not_ready" });
        return;
      }
      setPortfolio(data.portfolio);
      await fetchReport(data.portfolio);
    } catch {
      setView({ kind: "load_error" });
    }
  }, [sessionId, fetchReport]);

  useEffect(() => {
    load();
    vacanciesApi
      .get(Number(vacancyId))
      .then((res) => setRoleTitle(res.data.vacancy.role_title))
      .catch(() => setRoleTitle(null));
    sessionsApi
      .get(Number(sessionId))
      .then((res) => setCandidateName(res.data.session.candidate_name ?? null))
      .catch(() => setCandidateName(null));
  }, [load, vacancyId, sessionId]);

  usePolling(
    () => {
      if (portfolio) return fetchReport(portfolio);
    },
    POLL_INTERVAL_MS,
    view.kind === "generating" && !!portfolio,
  );

  const handleRegenerate = async () => {
    if (!portfolio) return;
    setBusy("regenerate");
    setActionError(null);
    try {
      await portfoliosApi.regenerateFitGap(portfolio.id, Number(vacancyId));
      startGenerating();
    } catch {
      setActionError("Couldn't start a new report. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleExport = async () => {
    if (!portfolio) return;
    setBusy("export");
    setActionError(null);
    try {
      const res = await portfoliosApi.exportPortfolio(portfolio.id, "pdf", Number(vacancyId));
      downloadFile(res.data as BlobPart, `fit-gap-${sessionId}-${vacancyId}.pdf`, "application/pdf");
    } catch {
      setActionError("Couldn't export the PDF. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  };

  const report = view.kind === "ready" ? view.report : null;
  const discovered = portfolio?.skills.filter((s) => s.is_discovered && s.assessed) ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Link
            to={portfolioPath}
            aria-label="Back to portfolio"
            className="mt-1 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Fit/gap report</h1>
            <p className="text-sm text-muted-foreground">
              {[candidateName, roleTitle && `for ${roleTitle}`].filter(Boolean).join(" ")}
            </p>
          </div>
        </div>

        {portfolio && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={busy !== null || view.kind === "generating"}
            >
              {busy === "regenerate" ? (
                <Loader2 aria-hidden className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw aria-hidden className="mr-1.5 h-3.5 w-3.5" />
              )}
              Regenerate
            </Button>
            {report && (
              <Button variant="outline" size="sm" onClick={handleExport} disabled={busy !== null}>
                {busy === "export" ? (
                  <Loader2 aria-hidden className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download aria-hidden className="mr-1.5 h-3.5 w-3.5" />
                )}
                Export PDF
              </Button>
            )}
          </div>
        )}
      </header>

      {actionError && (
        <p role="alert" className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      )}

      <div aria-live="polite" className="space-y-6">
        {view.kind === "loading" && (
          <div className="space-y-4" aria-label="Loading report">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {view.kind === "load_error" && (
          <StatePanel title="Couldn't load this report" body="Check your connection, then try again.">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw aria-hidden className="mr-1.5 h-3.5 w-3.5" /> Try again
            </Button>
          </StatePanel>
        )}

        {view.kind === "portfolio_not_ready" && (
          <StatePanel
            title="The portfolio isn't ready yet"
            body="A fit/gap report compares the finished portfolio with the vacancy. Check the portfolio first."
          >
            <Button variant="outline" size="sm" asChild>
              <Link to={portfolioPath}>Go to the portfolio</Link>
            </Button>
          </StatePanel>
        )}

        {view.kind === "generating" && (
          <StatePanel
            title="Comparing the portfolio with the vacancy"
            body="This usually takes a few seconds."
            icon={<Loader2 aria-hidden className="h-6 w-6 animate-spin text-primary" />}
          />
        )}

        {view.kind === "timed_out" && (
          <StatePanel
            tone="error"
            title="The report is taking too long"
            body="Generation didn't finish within three minutes, so it has probably failed. Start it again."
          >
            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={busy !== null}>
              <RefreshCw aria-hidden className="mr-1.5 h-3.5 w-3.5" /> Generate again
            </Button>
          </StatePanel>
        )}

        {report && (
          <>
            {report.recommendation_status === "insufficient_evidence" && (
              <EvidenceGapsNotice
                gaps={report.evidence_gaps}
                portfolioPath={portfolioPath}
                vacancyEditPath={`/vacancies/${vacancyId}/edit`}
              />
            )}

            {report.recommendation_status === null && (
              <div className="flex flex-col gap-3 rounded-lg border border-attention-border bg-attention-surface p-4 text-sm text-attention sm:flex-row sm:items-center">
                <History aria-hidden className="h-5 w-5 shrink-0" />
                <p className="flex-1">
                  This report was generated before evidence checks existed, so its recommendation may rest on skills
                  that were never assessed. Regenerate it to check.
                </p>
              </div>
            )}

            <section aria-labelledby="comparison-title" className="space-y-3 rounded-lg border p-4 sm:p-5">
              <h2 id="comparison-title" className="text-sm font-semibold">
                Skill comparison
              </h2>
              {report.skill_comparisons.length > 0 ? (
                <ComparisonTable comparisons={report.skill_comparisons} />
              ) : (
                <p className="text-sm text-muted-foreground">This vacancy has no required skills to compare against.</p>
              )}
            </section>

            {report.recommendation_status !== "insufficient_evidence" && (
              <>
                {report.overall_narrative && (
                  <NarrativeSection id="recommendation" title="Recommendation" text={report.overall_narrative} />
                )}
                {report.culture_narrative && (
                  <NarrativeSection id="culture" title="Culture and competency fit" text={report.culture_narrative} />
                )}
                {(report.overall_narrative || report.culture_narrative) && (
                  <p className="text-xs text-muted-foreground">
                    Written by AI from the comparison above. Check it before acting on it.
                  </p>
                )}
              </>
            )}

            {discovered.length > 0 && (
              <section aria-labelledby="discovered-title" className="space-y-3">
                <div>
                  <h2 id="discovered-title" className="text-sm font-semibold">
                    Also demonstrated
                  </h2>
                  <p className="text-xs text-muted-foreground">Not required for this vacancy, but evidenced in the interview.</p>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {discovered.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                      <LevelBadge level={s.effective_level} size="sm" />
                      {s.skill_label}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NarrativeSection({ id, title, text }: { id: string; title: string; text: string }) {
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-2">
      <h2 id={`${id}-title`} className="text-sm font-semibold">
        {title}
      </h2>
      <p className="whitespace-pre-line break-words text-sm leading-relaxed">{text}</p>
    </section>
  );
}
