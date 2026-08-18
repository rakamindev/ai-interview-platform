import type { AssessmentSkill, SkillTaxonomy, Vacancy, VacancySkill } from "@/types";

function buildTaxonomyIndexes(taxonomies: SkillTaxonomy[] | undefined | null) {
  const byId = new Map<string, SkillTaxonomy>();
  const byLabel = new Map<string, SkillTaxonomy>();

  for (const t of taxonomies ?? []) {
    byId.set(String(t.skill_id), t);
    byLabel.set(t.skill_label.trim().toLowerCase(), t);
  }

  return { byId, byLabel };
}

function resolveTaxonomy(
  skill: VacancySkill,
  indexes: ReturnType<typeof buildTaxonomyIndexes>
): SkillTaxonomy | undefined {
  if (skill.skill_id != null && skill.skill_id !== "") {
    const byId = indexes.byId.get(String(skill.skill_id));
    if (byId) return byId;
  }
  return indexes.byLabel.get(skill.skill_label.trim().toLowerCase());
}

/**
 * Map vacancy skills into assessment_skills form shape.
 * When vacancy.skill_id is missing (legacy data), match taxonomy by label.
 */
export function mapVacancySkillsToAssessmentSkills(
  skills: VacancySkill[] | undefined | null,
  taxonomies?: SkillTaxonomy[] | null
): Partial<AssessmentSkill>[] {
  const indexes = buildTaxonomyIndexes(taxonomies);

  return (skills ?? []).map((skill, index) => {
    const taxonomy = resolveTaxonomy(skill, indexes);
    const hasTaxonomy =
      taxonomy != null || (skill.skill_id != null && skill.skill_id !== "");

    if (!hasTaxonomy) {
      return {
        skill_label: skill.skill_label,
        is_custom: true,
        expected_level: skill.expected_level,
        display_order: index,
      };
    }

    return {
      skill_id: skill.skill_id ?? taxonomy?.skill_id,
      skill_label: skill.skill_label || taxonomy?.skill_label || "",
      is_custom: false,
      expected_level: skill.expected_level,
      display_order: index,
      scope_include: taxonomy?.scope_include,
      scope_exclude: taxonomy?.scope_exclude,
      l1_anchor: skill.l1_anchor ?? taxonomy?.l1_anchor,
      l2_anchor: skill.l2_anchor ?? taxonomy?.l2_anchor,
      l3_anchor: skill.l3_anchor ?? taxonomy?.l3_anchor,
      l4_anchor: skill.l4_anchor ?? taxonomy?.l4_anchor,
      l5_anchor: skill.l5_anchor ?? taxonomy?.l5_anchor,
    };
  });
}

export function buildAssessmentPrefillFromVacancy(
  vacancy: Vacancy,
  taxonomies?: SkillTaxonomy[] | null
): {
  name: string;
  skills: Partial<AssessmentSkill>[];
} {
  return {
    name: vacancy.role_title,
    skills: mapVacancySkillsToAssessmentSkills(vacancy.skills, taxonomies),
  };
}
