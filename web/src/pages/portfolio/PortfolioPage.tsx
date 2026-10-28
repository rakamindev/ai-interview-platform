import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { CheckCircle2, FileDown, FileText, Inbox, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { Callout } from "@/components/ui/callout";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FitGapPicker from "@/components/portfolio/FitGapPicker";
import PortfolioSkeleton from "@/components/portfolio/PortfolioSkeleton";
import PortfolioSummary from "@/components/portfolio/PortfolioSummary";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { usePortfolioReview } from "@/hooks/usePortfolioReview";
import { portfoliosApi } from "@/services/portfolios";
import type { AssessorOverride, PortfolioSkill } from "@/types";

const EXPORT_ERROR = {
  pdf: "The PDF could not be created. Try again or export JSON instead.",
  json: "The JSON export failed. Try again.",
};
const OUTDATED_NOTE = " Fit/gap narratives that include this skill are now marked outdated until regenerated.";

function SkillList({ skills, overrides, onReviewChanged, onConflict }: {
  skills: PortfolioSkill[];
  overrides: Map<number, AssessorOverride>;
  onReviewChanged: (message: string) => void;
  onConflict: () => void;
}) {
  return (
    <div className="space-y-3">
      {skills.map((skill) => (
        <SkillPortfolioCard key={skill.id} skill={skill} override={overrides.get(skill.id)}
                            onOverrideSaved={() => {}} onReviewChanged={onReviewChanged} onConflict={onConflict} />
      ))}
    </div>
  );
}

export default function PortfolioPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const location = useLocation();
  const state = usePortfolioReview(Number(sessionId));
  const { portfolio } = state;
  const [message, setMessage] = useState("");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const vacancyRef = useRef<HTMLButtonElement>(null);
  const basePath = `/assessments/${id}/sessions/${sessionId}`;

  const overrides = useMemo(
    () => new Map((portfolio?.overrides ?? []).map((override) => [override.portfolio_skill_id, override])),
    [portfolio],
  );
  const skills = portfolio?.skills ?? [];
  const configured = skills.filter((skill) => !skill.is_discovered);
  const discovered = skills.filter((skill) => skill.is_discovered);
  const complete = portfolio?.generation_status === "complete";

  // A #fit-gap link (from the candidate list) lands on the vacancy picker,
  // which only exists once the vacancies have loaded.
  const vacancyCount = state.vacancies.length;
  const ready = complete && !state.loading;
  useEffect(() => {
    if (ready && location.hash === "#fit-gap") vacancyRef.current?.focus();
  }, [ready, location.hash, vacancyCount]);

  const handleReviewChanged = (text: string) => {
    setMessage(text + OUTDATED_NOTE);
    state.refresh();
  };

  // The error panel and the Retry generation button disappear after they
  // are used, so focus goes to the heading instead of the page body.
  const retry = async () => {
    await state.retry();
    headingRef.current?.focus();
  };

  const regenerate = async () => {
    await state.regenerate();
    headingRef.current?.focus();
  };

  const handleExport = async (format: "pdf" | "json") => {
    if (!portfolio || exporting) return;
    setExporting(format);
    setExportError(null);
    try {
      const res = await portfoliosApi.exportPortfolio(portfolio.id, format);
      const blob = format === "pdf"
        ? new Blob([res.data as BlobPart], { type: "application/pdf" })
        : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `portfolio-${sessionId}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(EXPORT_ERROR[format]);
    } finally {
      setExporting(null);
    }
  };

  if (state.loading) return <PortfolioSkeleton />;

  const listProps = { overrides, onReviewChanged: handleReviewChanged, onConflict: state.refresh };

  return (
    <PageShell>
      <PageHeader
        ref={headingRef}
        title="Portfolio"
        back={{ to: `/assessments/${id}/invite`, label: "Back to candidates" }}
        description={state.candidateName && <span className="font-medium text-foreground [overflow-wrap:anywhere]">{state.candidateName}</span>}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to={`${basePath}/transcript`}><FileText aria-hidden="true" />Transcript</Link>
            </Button>
            {(["pdf", "json"] as const).map((format) => (
              <Button key={format} variant={format === "pdf" ? "default" : "outline"} size="sm"
                      onClick={() => handleExport(format)} disabled={!complete}
                      aria-disabled={exporting !== null || undefined} className="aria-disabled:cursor-wait aria-disabled:opacity-60">
                {exporting === format ? <Loader2 aria-hidden="true" className="animate-spin" /> : <FileDown aria-hidden="true" />}
                {format === "pdf" ? "Export PDF" : "Export JSON"}
              </Button>
            ))}
          </>
        }
      />

      {exportError && <Callout variant="error" role="alert" title="Export failed">{exportError}</Callout>}

      <div role="status" aria-live="polite" aria-label="Review status">
        {message && (
          <p className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{message}</span>
          </p>
        )}
      </div>

      {state.error && !portfolio && (
        state.error.kind === "not_found" ? (
          <ErrorState title="We could not find this portfolio" description="It may have been removed, or you may not have access to it."
                      action={<Button asChild variant="outline"><Link to={`/assessments/${id}/invite`}>Back to candidates</Link></Button>} />
        ) : state.error.kind === "network" ? (
          <ErrorState title="Cannot reach the server" description="Check your connection and try again." onRetry={retry} retrying={state.retrying} />
        ) : (
          <ErrorState title="Could not load the portfolio" description="The server had a problem. Nothing was changed." onRetry={retry} retrying={state.retrying} />
        )
      )}

      {state.generating && (
        <Callout variant="info" title="Generating the portfolio">
          The AI is analysing the interview. This usually takes about 2 minutes; this page updates by itself.
        </Callout>
      )}

      {portfolio?.generation_status === "failed" && (
        <Callout variant="error" title="Portfolio generation failed"
                 action={<Button type="button" size="sm" variant="outline" onClick={regenerate} disabled={state.regenerating}>
                   {state.regenerating ? <Loader2 aria-hidden="true" className="animate-spin" /> : <RotateCw aria-hidden="true" />}
                   Retry generation
                 </Button>}>
          {portfolio.generation_error_message ?? "The portfolio could not be generated."}
          {state.regenerateFailed && " The retry could not be started; try again."}
        </Callout>
      )}

      {complete && portfolio && (
        <>
          {portfolio.ratings_validated === false && (
            <Callout variant="warning" title="Legacy portfolio">
              This portfolio was generated before ratings were validated. Levels are shown as stored; review each
              skill before relying on it.
            </Callout>
          )}
          {skills.length === 0 ? (
            <EmptyState icon={Inbox} title="This portfolio has no skills"
                        description="The interview did not produce any skill rating. Open the transcript, or rate skills after a follow-up interview." />
          ) : (
            <>
              <PortfolioSummary skills={skills} />
              {discovered.length > 0 ? (
                <Tabs defaultValue="configured" className="space-y-3">
                  <TabsList>
                    <TabsTrigger value="configured">{`Configured skills (${configured.length})`}</TabsTrigger>
                    <TabsTrigger value="discovered">{`Discovered skills (${discovered.length})`}</TabsTrigger>
                  </TabsList>
                  <TabsContent value="configured"><SkillList skills={configured} {...listProps} /></TabsContent>
                  <TabsContent value="discovered">
                    <p className="mb-3 text-sm text-muted-foreground">Skills the AI probed that were not in the assessment. They are not part of any fit/gap comparison.</p>
                    <SkillList skills={discovered} {...listProps} />
                  </TabsContent>
                </Tabs>
              ) : (
                <SkillList skills={configured} {...listProps} />
              )}
            </>
          )}
          <FitGapPicker ref={vacancyRef} basePath={basePath} vacancies={state.vacancies} />
        </>
      )}
    </PageShell>
  );
}
