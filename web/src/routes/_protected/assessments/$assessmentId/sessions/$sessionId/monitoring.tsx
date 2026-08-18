import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle, ClipboardList, Clock, Radio, Timer, User, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Frame, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@/components/ui/frame";
import { Progress, ProgressIndicator } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/layout/page-container";

import { EndSessionDialog } from "@/features/session/components/end-session-dialog";
import { TranscriptBubble } from "@/features/session/components/transcript-bubble";
import { useCoverageWebSocket } from "@/features/session/hooks/use-coverage-websocket";
import { sessionQueries } from "@/features/session/queries/session";
import type { TranscriptTurn } from "@/features/session/schemas/session";
import { COVERAGE_STATE_COLOR, COVERAGE_STATE_LABELS, COVERAGE_STATE_WIDTH } from "@/utils/constants";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_protected/assessments/$assessmentId/sessions/$sessionId/monitoring")({
  component: RouteComponent,
});

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <span className="flex items-center gap-1 text-sm tabular-nums text-muted-foreground">
      <Clock className="size-3.5" />
      {mm}:{ss}
    </span>
  );
}

function RouteComponent() {
  const { assessmentId, sessionId } = Route.useParams();
  const id = Number(sessionId);

  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const lastTurnRef = useRef(0);

  const { data: detailData, isLoading } = useQuery(sessionQueries.detail(id));
  const session = detailData?.session;

  const { coverageMap, sessionEnded, sessionEndReason, isConnected } = useCoverageWebSocket(id);
  const sessionActive = session?.status === "active" && !sessionEnded;

  // Poll transcript every 3s while session is active. from_turn advances with lastTurnRef,
  // so the query key changes only when new turns arrive.
  const { data: transcriptRes } = useQuery({
    ...sessionQueries.transcript(id, lastTurnRef.current + 1),
    refetchInterval: sessionActive ? 3_000 : false,
  });

  useEffect(() => {
    const turns = transcriptRes?.turns ?? [];
    if (turns.length === 0) return;
    const lastTurn = turns[turns.length - 1].turn_number;
    if (lastTurn > lastTurnRef.current) {
      lastTurnRef.current = lastTurn;
      setTranscript((prev) => [...prev, ...turns].slice(-10));
    }
  }, [transcriptRes]);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </PageContainer>
    );
  }

  const configuredSkills = coverageMap?.skills ?? [];
  const discoveredSkills = coverageMap?.discovered ?? [];

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
              {session?.assessment.name ?? "Assessment"}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>Live Monitor</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          {typeof session === "undefined" ? (
            <Skeleton className="h-8 w-52" />
          ) : (
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">Live Monitor</h1>
          )}

          <div className="flex flex-wrap items-center gap-4">
            {typeof session === "undefined" ? (
              <Skeleton className="h-5 w-24" />
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="size-4 shrink-0" />
                {session.candidate_name}
              </p>
            )}

            {typeof session === "undefined" ? (
              <Skeleton className="h-5 w-24" />
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <ClipboardList className="size-4 shrink-0" />
                {session.assessment.name}
              </p>
            )}

            {typeof session === "undefined" ? (
              <Skeleton className="h-5 w-14" />
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Timer className="size-4 shrink-0" />
                {session.assessment.time_limit_min} min
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {session?.started_at && sessionActive && <ElapsedTimer startedAt={session.started_at} />}

          <span
            className={cn(
              "flex items-center gap-1 text-xs",
              isConnected ? "text-success" : "text-muted-foreground"
            )}
          >
            <Radio className="size-3" />
            {isConnected ? "Live" : "Reconnecting..."}
          </span>
        </div>
      </div>

      {/* Session ended banner */}
      {sessionEnded && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-3 text-sm">
          <CheckCircle className="size-4 shrink-0 text-success" />
          <div>
            <span className="font-medium">Session ended</span>
            {sessionEndReason && (
              <span className="ml-1.5 text-muted-foreground">
                — {sessionEndReason.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            render={
              <Link to="/assessments/$assessmentId/sessions/$sessionId/portfolio" params={{ assessmentId, sessionId }} />
            }
          >
            View portfolio →
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {/* Coverage map */}
        <Frame spacing="sm" dense className="h-full md:col-span-1">
          <FrameHeader>
            <FrameTitle className="text-sm">Coverage Status</FrameTitle>
          </FrameHeader>
          <FramePanel className="space-y-4">
            {configuredSkills.length === 0 && discoveredSkills.length === 0 ? (
              <p className="text-sm text-muted-foreground">Waiting for interview to begin...</p>
            ) : (
              configuredSkills.map((skill) => (
                <div key={skill.id} className="space-y-1.5">
                  <div className="space-y-1">
                    <span className="text-sm font-medium">{skill.skill_label}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {skill.probe_count > 0 && (
                        <span>
                          {skill.probe_count} probe{skill.probe_count !== 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="capitalize">{COVERAGE_STATE_LABELS[skill.state]}</span>
                    </div>
                  </div>
                  <Progress value={COVERAGE_STATE_WIDTH[skill.state]}>
                    <ProgressIndicator className={COVERAGE_STATE_COLOR[skill.state]} />
                  </Progress>
                  {skill.last_signal && (
                    <p className="text-xs text-muted-foreground">"{skill.last_signal}"</p>
                  )}
                </div>
              ))
            )}

            {/* Discovered skills */}
            {discoveredSkills.length > 0 && (
              <>
                {configuredSkills.length > 0 && <Separator />}
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Discovered
                  </p>
                  {discoveredSkills.map((skill) => (
                    <div key={skill.id} className="space-y-1.5">
                      <div className="space-y-1">
                        <span className="flex items-center gap-1 text-sm font-medium">
                          <Zap className="size-3 text-amber-500" />
                          {skill.skill_label}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {skill.probe_count > 0 && (
                            <span>
                              {skill.probe_count} probe{skill.probe_count !== 1 ? "s" : ""}
                            </span>
                          )}
                          <span className="capitalize">{COVERAGE_STATE_LABELS[skill.state]}</span>
                        </div>
                      </div>
                      <Progress value={COVERAGE_STATE_WIDTH[skill.state]}>
                        <ProgressIndicator className="bg-amber-400" />
                      </Progress>
                      {skill.last_signal && (
                        <p className="text-xs text-muted-foreground">"{skill.last_signal}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </FramePanel>
        </Frame>

        {/* Live transcript */}
        <Frame spacing="sm" dense className="h-full md:col-span-2">
          <FrameHeader>
            <FrameTitle className="text-sm">Live Transcript</FrameTitle>
          </FrameHeader>
          <FramePanel>
            {transcript.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transcript yet.</p>
            ) : (
              <div className="space-y-2">
                {transcript.map((turn) => (
                  <TranscriptBubble key={turn.id} speaker={turn.speaker} text={turn.text} />
                ))}
              </div>
            )}
          </FramePanel>
          {sessionActive ? (
            <FrameFooter className="flex-row justify-end">
              <EndSessionDialog sessionId={id} assessmentId={assessmentId} />
            </FrameFooter>
          ) : null}
        </Frame>
      </div>
    </PageContainer>
  );
}
