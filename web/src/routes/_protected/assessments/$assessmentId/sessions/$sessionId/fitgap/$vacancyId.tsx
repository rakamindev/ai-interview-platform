import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ClipboardList, Download, Info, Loader2, RefreshCw, User, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@/components/ui/frame";
import { PageContainer } from "@/components/layout/page-container";

import { ComparisonTable } from "@/features/portfolio/components/comparison-table";
import { portfolioMutations } from "@/features/portfolio/mutations/portfolio";
import { portfolioQueries } from "@/features/portfolio/queries/portfolio";
import type { FitGapSummary, SkillComparison } from "@/features/portfolio/schemas/fitgap";
import { sessionQueries } from "@/features/session/queries/session";

export const Route = createFileRoute(
  "/_protected/assessments/$assessmentId/sessions/$sessionId/fitgap/$vacancyId"
)({
  component: RouteComponent,
});

type ComparisonFilter = "all" | "gap" | "not_assessed" | "fit";

function fallbackSummary(comparisons: SkillComparison[]): FitGapSummary {
  const gaps = comparisons.filter((c) => c.result === "gap");
  return {
    match_count: comparisons.filter((c) => c.result === "match").length,
    exceed_count: comparisons.filter((c) => c.result === "exceed").length,
    gap_count: gaps.length,
    not_assessed_count: comparisons.filter((c) => c.result === "not_assessed").length,
    priority_gaps: [...gaps]
      .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))
      .map((c) => c.skill_label),
  };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function RouteComponent() {
  const { assessmentId, sessionId, vacancyId } = Route.useParams();
  const id = Number(sessionId);
  const vid = Number(vacancyId);
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<ComparisonFilter>("all");
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const triggeredRef = useRef(false);

  const { data: detailData } = useQuery(sessionQueries.detail(id));
  const { data: portfolioData } = useQuery(portfolioQueries.bySession(id));
  const portfolio = portfolioData && "portfolio" in portfolioData ? portfolioData.portfolio : undefined;

  const fitGapQuery = useQuery({
    ...portfolioQueries.fitGap(portfolio?.id ?? 0, vid),
    enabled: !!portfolio?.id,
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.report.narrative_status;
      return status === "pending" || status === "generating" ? 5_000 : false;
    },
  });

  const report = fitGapQuery.data?.report;
  const is404 = fitGapQuery.isError && fitGapQuery.error.response.status === 404;

  const triggerMutation = useMutation({
    ...portfolioMutations.triggerFitGap(portfolio?.id ?? 0),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioQueries.fitGapKey(portfolio?.id ?? 0, vid) });
    },
  });

  // No report yet → trigger generation once
  useEffect(() => {
    if (!is404 || !portfolio || triggeredRef.current) return;
    triggeredRef.current = true;
    triggerMutation.mutate(vid);
  }, [is404, portfolio, vid, triggerMutation]);

  const regenerateMutation = useMutation({
    ...portfolioMutations.regenerateFitGap(portfolio?.id ?? 0),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioQueries.fitGapKey(portfolio?.id ?? 0, vid) });
    },
  });

  const exportMutation = useMutation({
    ...portfolioMutations.export(portfolio?.id ?? 0),
    onSuccess: async (blob, variables) => {
      const filename = `fitgap-${sessionId}-${vacancyId}.${variables.format}`;
      if (variables.format === "pdf") {
        triggerDownload(blob, filename);
      } else {
        const text = await blob.text();
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          json = text;
        }
        triggerDownload(new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }), filename);
      }
    },
  });

  useEffect(() => {
    if (!exportMutation.isPending) setExporting(null);
  }, [exportMutation.isPending]);

  const comparisons = report?.skill_comparisons ?? [];
  const summary = report?.summary ?? fallbackSummary(comparisons);
  const narrativeStatus = report?.narrative_status ?? (report?.culture_narrative || report?.overall_narrative ? "complete" : "pending");
  const generating =
    !!portfolio &&
    (report
      ? report.narrative_status === "pending" || report.narrative_status === "generating"
      : !fitGapQuery.isError);

  const filteredComparisons = comparisons.filter((c) => {
    if (filter === "gap") return c.result === "gap";
    if (filter === "not_assessed") return c.result === "not_assessed";
    if (filter === "fit") return c.result === "match" || c.result === "exceed";
    return true;
  });

  const additionalSignals =
    report?.additional_skill_signals ??
    (portfolio?.skills
      .filter((s) => s.is_discovered)
      .map((s) => ({
        skill_id: s.skill_id?.toString(),
        skill_label: s.skill_label,
        candidate_level: s.ai_level,
        confidence: s.ai_confidence,
        is_override: false,
      })) ??
      []);

  const candidateName = detailData?.session.candidate_name ?? null;
  const assessmentName = detailData?.session.assessment.name;

  return (
    <PageContainer>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/assessments" />}>Assessments</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/assessments/$assessmentId" params={{ assessmentId }} />}>
              {assessmentName ?? "Assessment"}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>Fit/Gap Report</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Fit/Gap Report</h1>
          <div className="flex flex-wrap items-center gap-4">
            {candidateName && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="size-4 shrink-0" />
                {candidateName}
              </p>
            )}
            {assessmentName && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <ClipboardList className="size-4 shrink-0" />
                {assessmentName}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => regenerateMutation.mutate(vid)}
            disabled={regenerateMutation.isPending || generating}
          >
            {regenerateMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 size-3.5" />
            )}
            Regenerate
          </Button>
          {report && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setExporting("pdf");
                  exportMutation.mutate({ format: "pdf", vacancyId: vid });
                }}
                disabled={!!exporting}
              >
                {exporting === "pdf" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="mr-1 size-3.5" />
                )}
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setExporting("json");
                  exportMutation.mutate({ format: "json", vacancyId: vid });
                }}
                disabled={!!exporting}
              >
                {exporting === "json" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="mr-1 size-3.5" />
                )}
                JSON
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Generating indicator */}
      {generating && (
        <div className="flex items-center gap-3 rounded-lg bg-primary/5 px-4 py-3">
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {report
              ? "Comparison is ready. AI narrative is still generating."
              : "Preparing Fit/Gap comparison..."}
          </p>
        </div>
      )}

      {report && (
        <>
          {/* Comparison summary */}
          <Frame spacing="sm" dense>
            <FrameHeader>
              <FrameTitle className="text-sm">Comparison Summary</FrameTitle>
            </FrameHeader>
            <FramePanel className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg bg-green-50 px-3 py-2">
                  <p className="text-xl font-semibold text-green-700">{summary.match_count}</p>
                  <p className="text-xs text-green-700">Match</p>
                </div>
                <div className="rounded-lg bg-green-50 px-3 py-2">
                  <p className="text-xl font-semibold text-green-700">{summary.exceed_count}</p>
                  <p className="text-xs text-green-700">Exceeds</p>
                </div>
                <div className="rounded-lg bg-amber-50 px-3 py-2">
                  <p className="text-xl font-semibold text-amber-700">{summary.gap_count}</p>
                  <p className="text-xs text-amber-700">Gap</p>
                </div>
                <div className="rounded-lg bg-neutral-50 px-3 py-2">
                  <p className="text-xl font-semibold text-neutral-600">{summary.not_assessed_count}</p>
                  <p className="text-xs text-neutral-600">Not assessed</p>
                </div>
              </div>

              {summary.priority_gaps.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Priority gaps</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {summary.priority_gaps.map((skill) => (
                      <span key={skill} className="text-sm font-medium text-amber-900">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(report.caveats ?? []).length > 0 && (
                <div className="space-y-1.5">
                  {(report.caveats ?? []).map((caveat) => (
                    <p key={caveat} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Info className="mt-0.5 size-3.5 shrink-0" /> {caveat}
                    </p>
                  ))}
                </div>
              )}
            </FramePanel>
          </Frame>

          {/* Comparison table */}
          <Frame spacing="sm" dense>
            <FrameHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <FrameTitle className="text-sm">Required Skill Comparison</FrameTitle>
                <div className="flex flex-wrap gap-1">
                  {(["all", "gap", "not_assessed", "fit"] as ComparisonFilter[]).map((value) => (
                    <Button
                      key={value}
                      variant={filter === value ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setFilter(value)}
                    >
                      {value === "not_assessed" ? "Unassessed" : value === "all" ? "All" : value === "fit" ? "Fit" : "Gaps"}
                    </Button>
                  ))}
                </div>
              </div>
            </FrameHeader>
            <FramePanel>
              {filteredComparisons.length > 0 ? (
                <ComparisonTable comparisons={filteredComparisons} />
              ) : (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No skills match this filter.
                </p>
              )}
            </FramePanel>
          </Frame>

          {/* AI Narrative */}
          <Frame spacing="sm" dense>
            <FrameHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <FrameTitle className="text-sm">AI Narrative</FrameTitle>
                {narrativeStatus === "failed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => regenerateMutation.mutate(vid)}
                    disabled={regenerateMutation.isPending}
                  >
                    <RefreshCw className="mr-1 size-3.5" /> Retry
                  </Button>
                )}
              </div>
            </FrameHeader>
            <FramePanel>
              {narrativeStatus === "failed" ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <AlertTriangle className="size-4" /> Narrative unavailable
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Deterministic comparison remains valid. Retry narrative generation when ready.
                  </p>
                </div>
              ) : narrativeStatus !== "complete" ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Narrative is being generated. Comparison remains available.
                </p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Culture &amp; competency
                    </p>
                    <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
                      {report.culture_narrative || "No culture narrative available."}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Overall context
                    </p>
                    <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
                      {report.overall_narrative || "No overall narrative available."}
                    </p>
                  </div>
                </div>
              )}
            </FramePanel>
          </Frame>

          {/* Additional signals */}
          {additionalSignals.length > 0 && (
            <Frame spacing="sm" dense>
              <FrameHeader>
                <FrameTitle className="flex items-center gap-1.5 text-sm">
                  <Zap className="size-4 text-amber-500" /> Additional Skill Signals
                </FrameTitle>
              </FrameHeader>
              <FramePanel className="space-y-2">
                {additionalSignals.map((skill) => (
                  <div
                    key={`${skill.skill_id ?? "skill"}-${skill.skill_label}`}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <span className="font-medium">{skill.skill_label}</span>
                    {skill.candidate_level != null && (
                      <span className="text-muted-foreground">L{skill.candidate_level}</span>
                    )}
                    {skill.confidence && <span className="text-xs text-muted-foreground">{skill.confidence} confidence</span>}
                    <span className="text-xs text-muted-foreground">Not required for this Vacancy.</span>
                  </div>
                ))}
              </FramePanel>
            </Frame>
          )}
        </>
      )}
    </PageContainer>
  );
}
