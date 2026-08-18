import type { VacancySkill } from "@/types";

export function isCustomVacancySkill(skill: {
  skill_id?: string | number | null;
}): boolean {
  return skill.skill_id == null || skill.skill_id === "";
}

/** Normalize form skills for vacancy create/update payloads. */
export function toVacancySkillsAttributes(
  skills: Partial<VacancySkill>[]
): Partial<VacancySkill>[] {
  return skills
    .filter((s) => (s.skill_label ?? "").trim().length > 0)
    .map((s) => ({
      ...(s.id != null ? { id: s.id } : {}),
      skill_id: isCustomVacancySkill(s) ? null : s.skill_id,
      skill_label: (s.skill_label ?? "").trim(),
      expected_level: s.expected_level ?? 3,
      ...(s._destroy ? { _destroy: s._destroy } : {}),
    }));
}
