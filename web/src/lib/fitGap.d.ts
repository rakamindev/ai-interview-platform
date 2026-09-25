import type { FitGapReport, SkillComparison } from "@/types";

export interface FitGapSummary {
  match: number;
  gap: number;
  exceed: number;
  not_assessed: number;
  lowConfidence: number;
  overrides: number;
}

export type FitGapResponseState = "complete" | "generating" | "failed" | "invalid";

export function summarizeFitGap(comparisons: SkillComparison[]): FitGapSummary;
export function hasCompletedFitGapReport(payload: unknown): payload is { report: FitGapReport };
export function fitGapResponseState(payload: unknown): FitGapResponseState;
export function shouldPollFitGap(payload: unknown): boolean;
