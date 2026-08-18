import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Brain, Calendar, Clock, Languages, Users } from "lucide-react";

import { Frame, FrameFooter, FramePanel } from "@/components/ui/frame";
import { Skeleton } from "@/components/ui/skeleton";

import type { Assessment, LatestSession } from "../schemas/assessment";

interface AssessmentCardProps {
  data: Assessment;
}

export function AssessmentCard({ data }: AssessmentCardProps) {
  return (
    <Frame
      className="group"
      spacing="sm"
      dense
      render={<Link to="/assessments/$assessmentId" params={{ assessmentId: String(data.id) }} />}
    >
      <FramePanel>
        <div className="flex h-full flex-col justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h3
              title={data.name}
              className="line-clamp-2 font-heading text-base font-medium group-hover:text-primary group-hover:underline group-hover:underline-offset-3"
            >
              {data.name}
            </h3>
            <AssessmentLatestSession session={data.latest_session} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="size-4 shrink-0" />
                Duration
              </p>
              <p className="text-right text-sm font-medium text-foreground tabular-nums">{data.time_limit_min} min</p>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Languages className="size-4 shrink-0" />
                Languange
              </p>
              <p className="text-right text-sm font-medium text-foreground">
                {data.language === "en" ? "English" : "Indonesia"}
              </p>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Brain className="size-4 shrink-0" />
                Skills
              </p>
              <p className="text-right text-sm font-medium text-foreground tabular-nums">{data.skills_count}</p>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="size-4 shrink-0" />
                Candidate
              </p>
              <p className="text-right text-sm font-medium text-foreground tabular-nums">{data.candidates_count}</p>
            </div>
          </div>
        </div>
      </FramePanel>
      <FrameFooter>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Calendar className="size-3.5 shrink-0" />
          {format(data.created_at, "dd/MM/yyyy HH:mm")}
        </p>
      </FrameFooter>
    </Frame>
  );
}

function AssessmentLatestSession({ session }: { session: LatestSession | null }) {
  if (!session) return null;

  if (session.status === "active") {
    return (
      <span className="flex items-center gap-1.5 text-sm font-medium text-success">
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-success" />
        Live now
      </span>
    );
  }

  if (session.status === "ended" && session.end_reason === "error") {
    return (
      <span className="flex items-center gap-1.5 text-sm font-medium text-destructive">
        <span className="size-2 shrink-0 rounded-full bg-destructive" />
        Failed
      </span>
    );
  }

  if (session.status === "ended") {
    return (
      <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
        <span className="size-2 shrink-0 rounded-full bg-primary" />
        Completed
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-sm font-medium text-warning">
      <span className="size-2 shrink-0 rounded-full bg-warning" />
      Awaiting candidate
    </span>
  );
}

export function AccountCardSkeleton() {
  return (
    <Frame spacing="sm" dense>
      <FramePanel>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="size-5 w-20" />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-32" />
            </div>

            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-32" />
            </div>

            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-32" />
            </div>

            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
        </div>
      </FramePanel>

      <FrameFooter>
        <Skeleton className="h-4 w-32" />
      </FrameFooter>
    </Frame>
  );
}
