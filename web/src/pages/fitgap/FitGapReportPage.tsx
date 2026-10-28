import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FileDown, ListPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { Callout } from "@/components/ui/callout";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import FitGapSkeleton from "@/components/fitgap/FitGapSkeleton";
import FollowUpList from "@/components/fitgap/FollowUpList";
import NarrativeSection from "@/components/fitgap/NarrativeSection";
import ReportSummary from "@/components/fitgap/ReportSummary";
import { useFitGapReport } from "@/hooks/useFitGapReport";
import { portfoliosApi } from "@/services/portfolios";
import { formatUtc } from "@/utils/datetime";
import type { ApiErrorInfo } from "@/utils/apiError";
import type { Portfolio } from "@/types";

const EXPORT_ERROR = {
  pdf: "The PDF could not be created. Try again or export JSON instead.",
  json: "The JSON export failed. Try again.",
};

function LoadError({ error, retry, retrying, portfolioPath, vacancyId }: {
  error: ApiErrorInfo; retry: () => void; retrying: boolean; portfolioPath: string; vacancyId: string;
}) {
  const backLink = (
    <Button asChild variant="outline"><Link to={portfolioPath}>Back to the portfolio</Link></Button>
  );
  switch (error.kind) {
    case "not_found":
      return <ErrorState title="We could not find this report"
                         description="It may have been removed, or you may not have access to it." action={backLink} />;
    case "network":
      return <ErrorState title="Cannot reach the server" description="Check your connection and try again."
                         onRetry={retry} retrying={retrying} />;
    case "vacancy_has_no_skills":
      return (
        <EmptyState icon={ListPlus} title="This vacancy has no required skills"
                    description="The fit/gap report compares the candidate with the vacancy's required skills. Add at least one to see the comparison."
                    action={<Button asChild><Link to={`/vacancies/${vacancyId}/edit`}>Add required skills</Link></Button>} />
      );
    case "portfolio_not_ready":
      return (
        <Callout variant="info" title="Portfolio not ready" action={backLink}>
          {error.generationStatus === "failed"
            ? "The portfolio could not be generated. Open the portfolio to retry it."
            : "The portfolio is still being generated. The report will be available when it is complete."}
        </Callout>
      );
    default:
      return <ErrorState title="Could not load the report" description="The server had a problem. Nothing was changed."
                         onRetry={retry} retrying={retrying} />;
  }
}

function DiscoveredSkills({ portfolio }: { portfolio: Portfolio }) {
  const discovered = portfolio.skills.filter((skill) => skill.is_discovered);
  if (discovered.length === 0) return null;

  return (
    <section aria-labelledby="discovered-skills" className="space-y-3 rounded-lg border bg-card p-4">
      <h2 id="discovered-skills" className="text-base font-semibold">Discovered skills</h2>
      <p className="text-sm text-muted-foreground">Not required for this role. Shown for context and not counted toward fit.</p>
      <ul className="space-y-2">
        {discovered.map((skill) => {
          const level = skill.effective_level ?? skill.ai_level;
          return (
            <li key={skill.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium [overflow-wrap:anywhere]">{skill.skill_label}</span>
              <span className="text-muted-foreground">{level ? `Level ${level}` : "Not assessed"}</span>
              {skill.ai_confidence && <ConfidenceBadge confidence={skill.ai_confidence} probeCount={skill.coverage?.probe_count} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function FitGapReportPage() {
  const { id, sessionId, vacancyId } = useParams<{ id: string; sessionId: string; vacancyId: string }>();
  const state = useFitGapReport(Number(sessionId), Number(vacancyId));
  const { portfolio, report } = state;
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const portfolioPath = `/assessments/${id}/sessions/${sessionId}/portfolio`;
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The error panel disappears once the report loads, so focus goes to the
  // page heading instead of falling back to the page body.
  const retry = async () => {
    await state.retry();
    headingRef.current?.focus();
  };

  const skillsById = useMemo(
    () => new Map((portfolio?.skills ?? []).map((skill) => [skill.id, skill])),
    [portfolio],
  );
  const hasRatedSkills = (portfolio?.skills ?? []).some((skill) => !skill.is_discovered);

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio || exporting) return;
    setExporting(format);
    setExportError(null);
    try {
      const res = await portfoliosApi.exportPortfolio(portfolio.id, format, Number(vacancyId));
      const blob = format === "pdf"
        ? new Blob([res.data as BlobPart], { type: "application/pdf" })
        : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fitgap-${sessionId}-${vacancyId}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(EXPORT_ERROR[format]);
    } finally {
      setExporting(null);
    }
  };

  if (state.loading) return <FitGapSkeleton />;

  return (
    <PageShell>
      <PageHeader
        ref={headingRef}
        title="Fit/Gap Report"
        back={{ to: portfolioPath, label: "Back to portfolio" }}
        description={
          <div className="space-y-1">
            <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {state.candidateName && (
                <div className="flex min-w-0 gap-1">
                  <dt className="text-muted-foreground">Candidate</dt>
                  <dd className="font-medium text-foreground [overflow-wrap:anywhere]">{state.candidateName}</dd>
                </div>
              )}
              {report?.role_title && (
                <div className="flex min-w-0 gap-1">
                  <dt className="text-muted-foreground">Vacancy</dt>
                  <dd className="font-medium text-foreground [overflow-wrap:anywhere]">{report.role_title}</dd>
                </div>
              )}
            </dl>
            {state.computedAt && (
              <p className="text-xs text-muted-foreground">Computed from current ratings, {formatUtc(state.computedAt)}</p>
            )}
          </div>
        }
        actions={
          <>
            {(["pdf", "json"] as const).map((format) => (
              <Button key={format} variant={format === "pdf" ? "default" : "outline"} size="sm"
                      onClick={() => handleExport(format)} disabled={!report}
                      aria-disabled={exporting !== null || undefined} className="aria-disabled:cursor-wait aria-disabled:opacity-60">
                {exporting === format ? <Loader2 aria-hidden="true" className="animate-spin" /> : <FileDown aria-hidden="true" />}
                {format === "pdf" ? "Export PDF" : "Export JSON"}
              </Button>
            ))}
          </>
        }
      />

      {exportError && <Callout variant="error" role="alert" title="Export failed">{exportError}</Callout>}

      {state.error && !report && (
        <LoadError error={state.error} retry={retry} retrying={state.retrying}
                   portfolioPath={portfolioPath} vacancyId={vacancyId ?? ""} />
      )}

      {report && (
        <>
          {report.ratings_validated === false && (
            <Callout variant="warning" title="Legacy portfolio"
                     action={<Button asChild size="sm" variant="outline"><Link to={portfolioPath}>Review on the portfolio page</Link></Button>}>
              This portfolio was generated before ratings were validated. Levels are shown as stored; review each skill
              before relying on them.
            </Callout>
          )}
          {portfolio && !hasRatedSkills && (
            <Callout variant="info" title="This portfolio has no rated skills">
              Every required skill is shown as not assessed and listed as a follow-up question.
            </Callout>
          )}
          <ReportSummary summary={report.summary} />
          <ComparisonTable comparisons={report.comparisons} skillsById={skillsById} />
          <FollowUpList comparisons={report.comparisons} />
          <NarrativeSection narrative={report.narrative} onRequest={state.requestNarrative}
                            requesting={state.requesting} requestFailed={state.requestFailed}
                            pollFailed={state.pollFailed} onCheckAgain={state.checkAgain} />
          {portfolio && <DiscoveredSkills portfolio={portfolio} />}
        </>
      )}
    </PageShell>
  );
}
