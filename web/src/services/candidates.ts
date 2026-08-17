import api from "./api";
import type { Candidate, InterviewStatus, PaginationMeta, Verdict } from "@/types";

export type CandidateSortField = "name" | "interview_date" | "interview_status" | "verdict";

export interface CandidateQuery {
  search?: string;
  interview_status?: Exclude<InterviewStatus, "active">;
  verdict?: Verdict;
  sort?: CandidateSortField;
  direction?: "asc" | "desc";
  page?: number;
  per_page?: number;
}

export type ExportFormat = "transcript" | "json" | "pdf";

export interface ExportResult {
  candidate_id: number;
  candidate_name?: string;
  status: "ok" | "failed" | "not_found";
  error?: string;
  data?: Record<string, unknown>;
}

export const candidatesApi = {
  list: (assessmentId: number, query: CandidateQuery = {}) =>
    api.get<{ candidates: Candidate[]; meta: PaginationMeta }>(
      `/assessments/${assessmentId}/candidates`,
      { params: query }
    ),

  export: (assessmentId: number, format: ExportFormat, candidateIds: number[]) =>
    api.post<{ exported_at: string; format: string; results: ExportResult[] }>(
      `/assessments/${assessmentId}/candidates/export`,
      { format, candidate_ids: candidateIds }
    ),
};
