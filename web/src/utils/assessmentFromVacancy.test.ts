import { describe, it, expect } from "vitest";
import {
  mapVacancySkillsToAssessmentSkills,
  buildAssessmentPrefillFromVacancy,
} from "./assessmentFromVacancy";
import type { SkillTaxonomy, Vacancy } from "@/types";

const reactTaxonomy: SkillTaxonomy = {
  skill_id: "SK-ENG-001",
  skill_label: "System Design & Architecture",
  category: "Engineering",
  scope_include: "Design systems",
  scope_exclude: "",
  l1_anchor: "L1",
  l2_anchor: "L2",
  l3_anchor: "L3",
  l4_anchor: "L4",
  l5_anchor: "L5",
};

describe("mapVacancySkillsToAssessmentSkills", () => {
  it("maps taxonomy vacancy skills with skill_id as non-custom", () => {
    const mapped = mapVacancySkillsToAssessmentSkills(
      [{ skill_id: "SK-ENG-001", skill_label: "System Design & Architecture", expected_level: 3 }],
      [reactTaxonomy]
    );

    expect(mapped[0]).toMatchObject({
      skill_id: "SK-ENG-001",
      is_custom: false,
      expected_level: 3,
      l1_anchor: "L1",
    });
  });

  it("resolves legacy vacancy skills (null skill_id) via label match", () => {
    const mapped = mapVacancySkillsToAssessmentSkills(
      [{ skill_label: "System Design & Architecture", expected_level: 4 }],
      [reactTaxonomy]
    );

    expect(mapped[0]).toMatchObject({
      skill_id: "SK-ENG-001",
      skill_label: "System Design & Architecture",
      is_custom: false,
      expected_level: 4,
      l3_anchor: "L3",
    });
  });

  it("keeps unmatched labels as custom skills", () => {
    const mapped = mapVacancySkillsToAssessmentSkills(
      [{ skill_label: "Custom Domain", expected_level: 2 }],
      [reactTaxonomy]
    );

    expect(mapped).toEqual([
      {
        skill_label: "Custom Domain",
        is_custom: true,
        expected_level: 2,
        display_order: 0,
      },
    ]);
  });

  it("returns empty array when vacancy has no skills", () => {
    expect(mapVacancySkillsToAssessmentSkills([])).toEqual([]);
    expect(mapVacancySkillsToAssessmentSkills(null)).toEqual([]);
  });
});

describe("buildAssessmentPrefillFromVacancy", () => {
  it("prefills role title and skills from vacancy", () => {
    const vacancy: Vacancy = {
      id: 1,
      role_title: "Middle Front End",
      culture_dimensions: "",
      competency_expectations: "",
      skills: [{ skill_label: "System Design & Architecture", expected_level: 3 }],
    };

    expect(buildAssessmentPrefillFromVacancy(vacancy, [reactTaxonomy])).toEqual({
      name: "Middle Front End",
      skills: [
        {
          skill_id: "SK-ENG-001",
          skill_label: "System Design & Architecture",
          is_custom: false,
          expected_level: 3,
          display_order: 0,
          scope_include: "Design systems",
          scope_exclude: "",
          l1_anchor: "L1",
          l2_anchor: "L2",
          l3_anchor: "L3",
          l4_anchor: "L4",
          l5_anchor: "L5",
        },
      ],
    });
  });
});
