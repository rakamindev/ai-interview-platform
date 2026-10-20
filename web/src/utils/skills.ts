import type { EndReason, NotAssessedReason, PortfolioSkill, SkillComparison } from "@/types";

export function isAssessed(skill: PortfolioSkill): boolean {
  return skill.assessment_status === "assessed" && skill.ai_level != null;
}

export function sortAssessedFirst(skills: PortfolioSkill[]): PortfolioSkill[] {
  return [...skills].sort((a, b) => Number(isAssessed(b)) - Number(isAssessed(a)));
}

export function summarizeSkills(skills: PortfolioSkill[]) {
  const configured = skills.filter((s) => !s.is_discovered);
  const rated = configured.filter(isAssessed).length;
  return { rated, total: configured.length, unrated: configured.length - rated };
}

export function countResults(comparisons: SkillComparison[]) {
  return {
    match: comparisons.filter((c) => c.result === "match").length,
    gap: comparisons.filter((c) => c.result === "gap").length,
    exceed: comparisons.filter((c) => c.result === "exceed").length,
    notAssessed: comparisons.filter((c) => c.result === "not_assessed").length,
  };
}

export const UNRATED_SKILL_COPY: Record<Exclude<PortfolioSkill["assessment_status"], "assessed">, { title: string; body: string }> = {
  not_assessed: {
    title: "Not assessed",
    body: "The interview ended before this skill came up. Nothing here counts for or against the candidate.",
  },
  insufficient_evidence: {
    title: "Not enough evidence",
    body: "This skill came up, but the answers were too brief to rate it. Treat the level as unknown, not low.",
  },
};

export const NOT_ASSESSED_REASON_COPY: Record<NotAssessedReason, string> = {
  not_covered: "Interview ended before this skill",
  insufficient_evidence: "Too little evidence to rate",
  not_in_assessment: "Not part of this interview",
};

export const END_REASON_COPY: Partial<Record<EndReason, string>> = {
  time_ceiling: "The interview reached its time limit",
  error: "The interview stopped because of a connection problem",
  manual_candidate: "The candidate ended the interview early",
  manual_assessor: "An assessor ended the interview early",
};

export function pluralize(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}
