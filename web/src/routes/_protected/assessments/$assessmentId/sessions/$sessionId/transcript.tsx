import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ClipboardList, CircleX, Download, FileText, User } from "lucide-react";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@/components/ui/frame";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/layout/page-container";

import { TranscriptBubble } from "@/features/session/components/transcript-bubble";
import { sessionQueries } from "@/features/session/queries/session";

export const Route = createFileRoute("/_protected/assessments/$assessmentId/sessions/$sessionId/transcript")({
  component: RouteComponent,
});

function RouteComponent() {
  const { assessmentId, sessionId } = Route.useParams();
  const id = Number(sessionId);

  const { data: detailData } = useQuery(sessionQueries.detail(id));
  const { data: transcriptData, isLoading, error } = useQuery(sessionQueries.transcript(id, 1));

  const turns = transcriptData?.turns ?? [];
  const candidateName = detailData?.session.candidate_name ?? null;
  const assessmentName = detailData?.session.assessment.name;

  const handleDownload = () => {
    const lines = turns.map((t) => {
      const label = t.speaker === "ai" ? "AI" : "Candidate";
      return `[${label}]\n${t.text}`;
    });
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-session-${sessionId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
            <BreadcrumbPage>Transcript</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Interview Transcript</h1>
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

        {!isLoading && !error && turns.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="mr-1.5 size-3.5" />
            Download .txt
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <Frame spacing="sm" dense>
          <FramePanel>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
                  <CircleX />
                </EmptyMedia>
                <EmptyTitle>Failed to load transcript. Please refresh.</EmptyTitle>
              </EmptyHeader>
            </Empty>
          </FramePanel>
        </Frame>
      )}

      {!isLoading && !error && turns.length === 0 && (
        <Frame spacing="sm" dense>
          <FramePanel>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyTitle>No transcript available for this session.</EmptyTitle>
              </EmptyHeader>
            </Empty>
          </FramePanel>
        </Frame>
      )}

      {!isLoading && !error && turns.length > 0 && (
        <Frame spacing="sm" dense>
          <FrameHeader>
            <FrameTitle>Conversation ({turns.length} turns)</FrameTitle>
          </FrameHeader>
          <FramePanel className="space-y-2">
            {turns.map((turn) => (
              <TranscriptBubble key={turn.id} speaker={turn.speaker} text={turn.text} />
            ))}
          </FramePanel>
        </Frame>
      )}
    </PageContainer>
  );
}
