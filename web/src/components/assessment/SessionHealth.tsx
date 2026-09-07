import { cn } from "@/lib/utils";
import type { Assessment } from "@/types";

type LatestSession = NonNullable<Assessment["latest_session"]>;

export type HealthTone = "live" | "stale" | "problem" | "working" | "done" | "waiting";

export interface SessionHealth {
  tone: HealthTone;
  label: string;
  /** The sentence an assessor needs to decide whether to open this row. */
  detail?: string;
}

// A session that ran past its own time limit and never ended is not live, it is
// stuck. Padding covers a clock that has drifted and the sixty-second grace the
// audio middleware allows itself after the ceiling.
const STUCK_AFTER_MINUTES = 15;

/**
 * Turns a session record into the one line an assessor scanning a list actually
 * needs: does this need me?
 *
 * The list previously offered four readings — live, failed, completed, awaiting
 * — and collapsed several very different situations into them. A session that
 * died mid-interview still says "Live now" forever. A portfolio that failed to
 * generate said "Last: completed", because the session did complete; the thing
 * that failed came afterwards and was invisible until you opened the row. And a
 * session that ran to its time ceiling — which, before this branch, is what
 * happened whenever a candidate mentioned an unplanned skill near the end —
 * also read as "completed".
 */
export function sessionHealth(
  session: LatestSession | undefined,
  timeLimitMin: number,
  now: Date = new Date()
): SessionHealth | null {
  if (!session) return null;

  if (session.status === "pending") {
    return { tone: "waiting", label: "Awaiting candidate" };
  }

  if (session.status === "active") {
    const startedAt = session.started_at ? new Date(session.started_at) : null;
    const elapsedMin = startedAt ? (now.getTime() - startedAt.getTime()) / 60000 : 0;

    if (startedAt && elapsedMin > timeLimitMin + STUCK_AFTER_MINUTES) {
      return {
        tone: "stale",
        label: "Stuck in progress",
        detail: `Started ${Math.round(elapsedMin)} min ago and never ended — past the ${timeLimitMin} min limit.`,
      };
    }

    return { tone: "live", label: "Live now" };
  }

  // Ended. What matters from here is whether a usable portfolio came out of it.
  if (session.portfolio_status === "failed") {
    return {
      tone: "problem",
      label: "Portfolio failed",
      detail: "The interview finished but the rating could not be generated. Needs a retry.",
    };
  }

  if (session.portfolio_status === "generating" || session.portfolio_status === "pending") {
    return { tone: "working", label: "Generating portfolio" };
  }

  if (session.end_reason === "error") {
    return {
      tone: "problem",
      label: "Ended on an error",
      detail: "The connection dropped before the interview finished.",
    };
  }

  if (session.end_reason === "time_ceiling") {
    return {
      tone: "stale",
      label: "Hit the time limit",
      detail: "The session ran out of time rather than finishing its agenda.",
    };
  }

  if (!session.portfolio_status) {
    return {
      tone: "waiting",
      label: "No portfolio yet",
      detail: "The session ended but nothing has been generated from it.",
    };
  }

  return { tone: "done", label: "Completed" };
}

const TONE_CLASSES: Record<HealthTone, string> = {
  live: "text-primary",
  stale: "text-amber-700",
  problem: "text-destructive",
  working: "text-blue-700",
  done: "text-muted-foreground",
  waiting: "text-muted-foreground",
};

const TONE_DOT: Record<HealthTone, string> = {
  live: "bg-primary animate-pulse",
  stale: "bg-amber-500",
  problem: "bg-destructive",
  working: "bg-blue-500 animate-pulse",
  done: "bg-neutral-300",
  waiting: "bg-neutral-300",
};

export default function SessionHealthBadge({
  session,
  timeLimitMin,
}: {
  session: LatestSession | undefined;
  timeLimitMin: number;
}) {
  const health = sessionHealth(session, timeLimitMin);
  if (!health) return null;

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", TONE_CLASSES[health.tone])}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[health.tone])} aria-hidden="true" />
      <span className="font-medium">{health.label}</span>
    </span>
  );
}
