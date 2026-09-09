import type { CandidateInfo } from "@/types";

export type CandidateAccessState = "loading" | "ready" | "completed" | "unavailable";

export function getCandidateAccessState(
  candidateInfo: CandidateInfo | null,
  hasLoadError: boolean
): CandidateAccessState {
  if (hasLoadError) return "unavailable";
  if (!candidateInfo) return "loading";
  if (candidateInfo.session_status === "ended") return "completed";
  if (candidateInfo.session_status === "pending" || candidateInfo.session_status === "active") {
    return "ready";
  }

  return "unavailable";
}
