import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ClipboardList, Download, FileText, Loader2, RefreshCw, User, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Frame, FramePanel } from "@/components/ui/frame";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/layout/page-container";

import { FitGapTrigger } from "@/features/portfolio/components/fit-gap-trigger";
import { SkillPortfolioCard } from "@/features/portfolio/components/skill-portfolio-card";
import { portfolioMutations } from "@/features/portfolio/mutations/portfolio";
import { portfolioQueries } from "@/features/portfolio/queries/portfolio";
import type { AssessorOverride } from "@/features/portfolio/schemas/portfolio";
import { sessionQueries } from "@/features/session/queries/session";

export const Route = createFileRoute("/_protected/assessments/$assessmentId/sessions/$sessionId/portfolio")({
  component: RouteComponent,
});

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function RouteComponent() {
  const { assessmentId, sessionId } = Route.useParams();
  const id = Number(sessionId);

  const [overrides, setOverrides] = useState<Record<number, AssessorOverride>>({});
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [regenerateFailed, setRegenerateFailed] = useState(false);

  const { data: detailData } = useQuery(sessionQueries.detail(id));
  const candidateName = detailData?.session.candidate_name ?? null;

  const { data, isLoading } = useQuery({
    ...portfolioQueries.bySession(id),
    refetchInterval: (query) => {
      const status =
        query.state.data && "portfolio" in query.state.data
          ? query.state.data.portfolio.generation_status
          : undefined;
      return status === "pending" || status === "generating" ? 5_000 : false;
    },
  });

  const response = data;
  const portfolio = response && "portfolio" in response ? response.portfolio : undefined;
  const generating = !portfolio || portfolio.generation_status === "pending" || portfolio.generation_status === "generating";
  const generationError = portfolio?.generation_status === "failed" ? portfolio.generation_error : undefined;

  // Sync overrides from latest portfolio data
  useEffect(() => {
    if (!portfolio) return;
    setOverrides((prev) => {
      const map: Record<number, AssessorOverride> = { ...prev };
      portfolio.overrides.forEach((o) => {
        map[o.portfolio_skill_id] = o;
      });
      return map;
    });
  }, [portfolio]);

  const regenerateMutation = useMutation({
    ...portfolioMutations.regenerate(id),
    onError: () => setRegenerateFailed(true),
  });

  const exportMutation = useMutation({
    ...portfolioMutations.export(portfolio?.id ?? 0),
    onSuccess: async (blob, variables) => {
      if (variables.format === "pdf") {
        triggerDownload(blob, `portfolio-${sessionId}.pdf`);
      } else {
        const text = await blob.text();
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          json = text;
        }
        triggerDownload(
          new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }),
          `portfolio-${sessionId}.json`
        );
      }
    },
  });

  const handleExport = (format: "pdf" | "json") => {
    if (!portfolio) return;
    setExporting(format);
    exportMutation.mutate({ format });
  };

  useEffect(() => {
    if (!exportMutation.isPending) setExporting(null);
  }, [exportMutation.isPending]);

  const handleOverrideSaved = (skillId: number, override: AssessorOverride) => {
    setOverrides((prev) => ({ ...prev, [skillId]: override }));
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </PageContainer>
    );
  }

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
              {detailData?.session.assessment.name ?? "Assessment"}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>Portfolio Results</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Portfolio Results</h1>
          <div className="flex flex-wrap items-center gap-4">
            {candidateName && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="size-4 shrink-0" />
                {candidateName}
              </p>
            )}
            {detailData?.session.assessment.name && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <ClipboardList className="size-4 shrink-0" />
                {detailData.session.assessment.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link to="/assessments/$assessmentId/sessions/$sessionId/transcript" params={{ assessmentId, sessionId }} />
            }
          >
            <FileText className="mr-1 size-3.5" />
            Transcript
          </Button>
          {!generating && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("pdf")}
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
                onClick={() => handleExport("json")}
                disabled={!!exporting}
              >
                {exporting === "json" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="mr-1 size-3.5" />
                )}
                JSON
              </Button>
              <FitGapTrigger assessmentId={assessmentId} sessionId={sessionId} />
            </>
          )}
        </div>
      </div>

      {/* Generating state */}
      {generating && (
        <Frame spacing="sm" dense>
          <FramePanel className="space-y-3 p-12 text-center">
            <Loader2 className="mx-auto size-8 animate-spin text-primary" />
            <div>
              <p className="font-medium">Generating portfolio...</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The AI is analyzing the interview transcript. This takes about 2 minutes.
              </p>
            </div>
          </FramePanel>
        </Frame>
      )}

      {/* Failed state */}
      {!generating && portfolio.generation_status === "failed" && (
        <Frame spacing="sm" dense variant="inverse">
          <FramePanel className="space-y-3 p-6 text-center">
            <p className="text-sm text-destructive">Portfolio generation failed.</p>
            {generationError && <p className="text-xs text-muted-foreground">{generationError}</p>}
            {regenerateFailed && (
              <p className="text-xs text-destructive">Failed to queue regeneration. Please try again.</p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mx-auto"
              onClick={() => {
                setRegenerateFailed(false);
                regenerateMutation.mutate();
              }}
              disabled={regenerateMutation.isPending}
            >
              <RefreshCw className="mr-1.5 size-3.5" /> Retry
            </Button>
          </FramePanel>
        </Frame>
      )}

      {/* Ready state */}
      {!generating && portfolio.generation_status === "complete" && (
        <>
          {/* Configured skills */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Configured Skills</h2>
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
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                    <Zap className="size-4 text-amber-500" />
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
        </>
      )}

      {/* No portfolio yet */}
      {!portfolio && !generating && (
        <Frame spacing="sm" dense>
          <FramePanel>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyTitle>No portfolio for this session yet.</EmptyTitle>
              </EmptyHeader>
            </Empty>
          </FramePanel>
        </Frame>
      )}
    </PageContainer>
  );
}
