import api from "./api";

export type PipelineStage = "shortlisted" | "hired" | "rejected" | null;

export interface PipelineSession {
  id: number;
  assessment_id: number;
  assessment_name: string | null;
  candidate_name: string | null;
  status: "pending" | "active" | "ended" | "failed";
  end_reason: string | null;
  pipeline_stage: PipelineStage;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export type KanbanColumn =
  | "invited"
  | "interviewing"
  | "evaluated"
  | "shortlisted"
  | "hired"
  | "rejected";

export function deriveColumn(s: PipelineSession): KanbanColumn {
  // Manual stages override auto-derived
  if (s.pipeline_stage === "shortlisted") return "shortlisted";
  if (s.pipeline_stage === "hired") return "hired";
  if (s.pipeline_stage === "rejected") return "rejected";

  // Auto-derived from status
  if (s.status === "active") return "interviewing";
  if (s.status === "pending") return "invited";
  if (s.status === "ended" && s.end_reason !== "error") return "evaluated";

  // failed or ended with error → fall back to evaluated column
  return "evaluated";
}

export const pipelineApi = {
  getSessions: () => api.get<{ sessions: PipelineSession[] }>("/pipeline"),

  updateStage: (sessionId: number, stage: PipelineStage) =>
    api.patch<{ session: PipelineSession }>(`/sessions/${sessionId}`, {
      session: { pipeline_stage: stage },
    }),
};

