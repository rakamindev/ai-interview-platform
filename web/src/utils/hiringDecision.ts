import type { HiringDecision, Session } from "@/types";

export type CandidateDecisionStatus = {
  label: string;
  className: string;
  dotClassName: string;
};

const DECISION_STATUS: Record<HiringDecision, CandidateDecisionStatus> = {
  advance: { label: "Advanced", className: "text-success", dotClassName: "bg-success" },
  hold: { label: "On hold", className: "text-warning", dotClassName: "bg-warning" },
  reject: { label: "Rejected", className: "text-destructive", dotClassName: "bg-destructive" },
};

export function getCandidateDecisionStatus(
  session: Pick<Session, "status" | "end_reason" | "portfolio_status" | "hiring_decision">,
): CandidateDecisionStatus | null {
  if (session.hiring_decision) return DECISION_STATUS[session.hiring_decision];
  if (session.status === "ended" && session.end_reason !== "error") {
    if (session.portfolio_status === "failed") {
      return { label: "Report failed", className: "text-destructive", dotClassName: "bg-destructive" };
    }
    if (session.portfolio_status !== "complete") {
      return { label: "Generating report", className: "text-info", dotClassName: "bg-info" };
    }
    return { label: "Needs review", className: "text-warning", dotClassName: "bg-warning" };
  }
  return null;
}

export function shouldRefreshCandidateSessions(
  sessions: Array<Pick<Session, "status" | "portfolio_status" | "hiring_decision">>,
): boolean {
  return sessions.some((session) =>
    session.status === "pending" ||
    session.status === "active" ||
    (session.status === "ended" &&
      !session.hiring_decision &&
      (!session.portfolio_status || ["pending", "generating"].includes(session.portfolio_status))),
  );
}
