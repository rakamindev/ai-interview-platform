import type { Portfolio, Vacancy } from "@/types";

export type FitGapGenerationStatus = "pending" | "generating" | "complete" | "failed";
export type SkillComparisonResult = "match" | "gap" | "exceed" | "not_assessed";
export type FitGapDecisionStatus = "evidence_ready" | "review_required";

export interface SkillComparison {
  skill_label: string;
  required_level?: number;
  expected_level?: number;
  candidate_level?: number;
  result: SkillComparisonResult;
  delta?: number;
  is_override?: boolean;
  confidence?: "high" | "medium" | "low" | null;
  evidence_count?: number;
}

export interface FitGapReviewSummary {
  total_skills: number;
  match: number;
  gap: number;
  exceed: number;
  not_assessed: number;
  low_confidence: number;
  human_overrides: number;
  decision_status: FitGapDecisionStatus;
}

export interface FitGapReport {
  id: number;
  portfolio_id: number;
  vacancy_id: number;
  skill_comparisons: SkillComparison[];
  culture_narrative: string | null;
  overall_narrative: string | null;
  generated_at?: string;
  generation_status: FitGapGenerationStatus;
  generation_error?: string;
  review_summary?: FitGapReviewSummary;
}

export interface FitGapContext {
  portfolio: Portfolio;
  vacancy: Vacancy;
  candidateName: string | null;
}

export interface FitGapRouteIds {
  assessmentId: number;
  sessionId: number;
  vacancyId: number;
}

export type FitGapExportFormat = "pdf" | "json";
