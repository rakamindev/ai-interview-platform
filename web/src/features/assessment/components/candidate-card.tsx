import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, CircleX, Copy, Eye, User } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@/components/ui/frame";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { assessmentQueries } from "../queries/assessment";
import type { Session } from "@/features/session/schemas/session";
import { Link } from "@tanstack/react-router";

interface CandidateCardProps {
  id: number;
}

export function CandidateCard({ id }: CandidateCardProps) {
  const { data, isLoading, error } = useQuery({
    ...assessmentQueries.sessions(id),
    refetchInterval: (query) => {
      const hasActive = query.state.data?.sessions.some((s) => s.status !== "ended");
      if (!hasActive) return false;
      return 5_000;
    },
  });

  const sessions = data?.sessions ?? [];

  return (
    <Frame spacing="sm" dense>
      <FrameHeader>
        <FrameTitle>Candidates {!error ? `(${sessions.length})` : null}</FrameTitle>
      </FrameHeader>
      <FramePanel className="py-0">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-7 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        ) : error ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
                <CircleX />
              </EmptyMedia>
              <EmptyTitle>Failed to load assessment. Please refresh the page.</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : sessions.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <User />
              </EmptyMedia>
              <EmptyTitle>No candidates yet</EmptyTitle>
              <EmptyDescription>Click "Invite Candidate" to generate an interview link.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="divide-y">
            {sessions.map((session, index) => (
              <SessionRow key={session.id} session={session} index={index + 1} />
            ))}
          </div>
        )}
      </FramePanel>
    </Frame>
  );
}

function SessionRow({ session, index }: { session: Session; index: number }) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayName = session.candidate_name || `Candidate ${index}`;

  const onCopy = async () => {
    await navigator.clipboard.writeText(session.invite_url);
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
          {index}
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
          <p className="text-xs text-muted-foreground">
            {session.started_at ? format(session.started_at, "dd/MM/yyyy HH:mm") : "Not started"}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <SessionStatusBadge status={session.status} end_reason={session.end_reason} />

        {session.status === "pending" ? (
          <Tooltip>
            <TooltipTrigger
              closeOnClick={false}
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={copied ? "Copied!" : "Copy link"}
                  onClick={onCopy}
                />
              }
            >
              {copied ? <Check className="text-success" /> : <Copy />}
            </TooltipTrigger>
            <TooltipContent>{copied ? "Copied!" : "Copy link"}</TooltipContent>
          </Tooltip>
        ) : null}

        {session.status === "active" ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  nativeButton={false}
                  render={
                    <Link
                      to="/assessments/$assessmentId/sessions/$sessionId/monitoring"
                      params={{
                        assessmentId: String(session.assessment_id),
                        sessionId: String(session.id)
                      }}
                    />
                  }
                />
              }
            >
              <Eye />
            </TooltipTrigger>
            <TooltipContent>Monitor</TooltipContent>
          </Tooltip>
        ) : null}

        {session.status === "ended" && session.end_reason !== "error" ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  nativeButton={false}
                  render={
                    <Link
                      to="/assessments/$assessmentId/sessions/$sessionId/portfolio"
                      params={{
                        assessmentId: String(session.assessment_id),
                        sessionId: String(session.id)
                      }}
                    />
                  }
                />
              }
            >
              <Eye />
            </TooltipTrigger>
            <TooltipContent>Result</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}

function SessionStatusBadge({ status, end_reason }: Pick<Session, "status" | "end_reason">) {
  if (status === "active") {
    return (
      <span className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-success">
        <span className="size-2 animate-pulse rounded-full bg-success" />
        Live now
      </span>
    );
  }

  if (status === "ended" || status === "failed") {
    const failed = status === "failed" || end_reason === "error";
    return (
      <span
        className={`inline-flex w-fit items-center gap-1.5 text-sm font-medium ${failed ? "text-destructive" : "text-primary"
          }`}
      >
        <span className={`size-2 rounded-full ${failed ? "bg-destructive" : "bg-primary"}`} />
        {failed ? "Failed" : "Completed"}
      </span>
    );
  }

  return (
    <span className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-warning">
      <span className="size-2 animate-pulse rounded-full bg-warning" />
      Awaiting candidate
    </span>
  );
}
