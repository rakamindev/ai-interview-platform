import type { CoverageMap, CoverageSkill } from "@/types";

const COVERAGE_STATES = [
  "not_yet",
  "initiated",
  "partial",
  "covered",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCoverageSkill(value: unknown): value is CoverageSkill {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "number" &&
    Number.isInteger(value.id) &&
    (typeof value.skill_id === "string" || value.skill_id === null) &&
    typeof value.skill_label === "string" &&
    value.skill_label.trim().length > 0 &&
    value.skill_label.length <= 255 &&
    typeof value.is_discovered === "boolean" &&
    COVERAGE_STATES.includes(value.state as (typeof COVERAGE_STATES)[number]) &&
    typeof value.probe_count === "number" &&
    Number.isInteger(value.probe_count) &&
    value.probe_count >= 0 &&
    (value.last_signal === null ||
      value.last_signal === undefined ||
      typeof value.last_signal === "string")
  );
}

export function parseCoverageUpdate(value: unknown): CoverageMap | null {
  if (!isRecord(value) || value.type !== "coverage_update") {
    return null;
  }

  if (!Array.isArray(value.skills) || !Array.isArray(value.discovered)) {
    return null;
  }

  if (
    !value.skills.every(isCoverageSkill) ||
    !value.discovered.every(isCoverageSkill)
  ) {
    return null;
  }

  return {
    skills: value.skills,
    discovered: value.discovered,
  };
}
