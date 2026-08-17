import api from "./api";
import type { PaginationMeta } from "@/types";

export interface CandidateSummary {
  id: number;
  candidate_id?: number;
  candidate_name?: string | null;
  assessment_id: number;
  assessment_name: string;
  status: "pending" | "active" | "ended";
  end_reason?: string | null;
  portfolio_status?: string | null;
  started_at?: string;
  created_at?: string;
}

export interface MatchSkill {
  skill_label: string;
  expected_level: number;
  candidate_level?: number | null;
  result: "match" | "exceed" | "gap" | "not_assessed";
  delta?: number | null;
}

export interface MatchEntry {
  session_id: number;
  candidate_name: string;
  assessment_name: string;
  score: number;
  skills: MatchSkill[];
}

export interface CandidateListParams {
  page?: number;
  per_page?: number;
  q?: string;
  status?: "awaiting" | "live" | "completed" | "failed";
  sort?: "newest" | "oldest" | "name";
}

export const candidatesApi = {
  list: (params: CandidateListParams = {}) =>
    api.get<{ candidates: CandidateSummary[]; meta: PaginationMeta }>("/candidates", { params }),

  matches: (vacancyId: number) =>
    api.get<{ vacancy: { id: number; role_title: string }; matches: MatchEntry[] }>(
      `/vacancies/${vacancyId}/matches`
    ),
};
