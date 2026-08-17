import type { PortfolioSkill, AssessorOverride } from "@/types";

function parseLevel(aiLevel: string | number | null | undefined): number {
  if (aiLevel === null || aiLevel === undefined) return 0;
  const n = typeof aiLevel === "number" ? aiLevel : Number(aiLevel.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 0;
}

interface Row {
  label: string;
  level: number;
  lowConfidence: boolean;
}

function buildRows(skills: PortfolioSkill[], overrides: Record<number, AssessorOverride>): Row[] {
  return skills
    .map((skill) => {
      const override = overrides[skill.id];
      const level = override ? override.override_level : parseLevel(skill.ai_level);
      return {
        label: skill.skill_label,
        level,
        lowConfidence: !override && skill.ai_confidence?.toLowerCase() === "low",
      };
    })
    .filter((row) => row.level > 0);
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/**
 * One or two plain-English sentences summarizing where a candidate is strong
 * and where the assessment left real doubt, so a hiring manager gets a verdict
 * instead of a table of numbers to interpret themselves.
 */
export function buildVerdict(
  skills: PortfolioSkill[],
  overrides: Record<number, AssessorOverride>
): string | null {
  const rows = buildRows(skills, overrides);
  if (rows.length === 0) return null;

  const strengths = rows.filter((r) => r.level >= 4).sort((a, b) => b.level - a.level);
  const concerns = rows
    .filter((r) => r.level <= 2 || r.lowConfidence)
    .sort((a, b) => a.level - b.level);

  const strengthNames = joinNames(strengths.slice(0, 2).map((r) => r.label));
  const concernNames = joinNames(concerns.slice(0, 2).map((r) => r.label));

  if (strengths.length > 0 && concerns.length > 0) {
    return `Strong on ${strengthNames}. Less certain on ${concernNames} — worth a follow-up before deciding.`;
  }

  if (strengths.length > 0) {
    return `Strong across the board, especially ${strengthNames}.`;
  }

  if (concerns.length > 0) {
    return rows.length === 1
      ? `Only tested on ${rows[0].label}, and the result was weak or uncertain — treat this as a narrow, inconclusive read.`
      : `Weak or uncertain results on ${concernNames} — worth a follow-up before deciding.`;
  }

  return "Solid, consistent performance across everything assessed.";
}
