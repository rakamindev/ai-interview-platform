import api from "./api";

export interface ResultRow {
  session_id: number;
  assessment_id: number;
  assessment_name: string;
  candidate_name: string | null;
  ended_at: string | null;
  end_reason: string | null;
  duration_seconds: number | null;
  portfolio_id: number;
  portfolio_status: "pending" | "generating" | "complete" | "failed";
  skill_count: number;
  unassessed_count: number;
  low_confidence_count: number;
  override_count: number;
  decision: "advance" | "hold" | "reject" | null;
  decided_at: string | null;
  needs_attention: boolean;
}

export const resultsApi = {
  list: (opts: { decision?: string; needsAttention?: boolean; assessmentId?: number } = {}) =>
    api.get<{ results: ResultRow[]; meta: { total: number; undecided: number } }>("/results", {
      params: {
        decision: opts.decision && opts.decision !== "all" ? opts.decision : undefined,
        needs_attention: opts.needsAttention ? "true" : undefined,
        assessment_id: opts.assessmentId,
      },
    }),
};
