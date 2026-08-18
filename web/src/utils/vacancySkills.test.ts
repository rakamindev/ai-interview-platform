import { describe, it, expect } from "vitest";
import { isCustomVacancySkill, toVacancySkillsAttributes } from "./vacancySkills";

describe("isCustomVacancySkill", () => {
  it("treats missing or empty skill_id as custom", () => {
    expect(isCustomVacancySkill({})).toBe(true);
    expect(isCustomVacancySkill({ skill_id: null })).toBe(true);
    expect(isCustomVacancySkill({ skill_id: "" })).toBe(true);
  });

  it("treats taxonomy skill_id as not custom", () => {
    expect(isCustomVacancySkill({ skill_id: "SK-ENG-001" })).toBe(false);
  });
});

describe("toVacancySkillsAttributes", () => {
  it("keeps _destroy so removed skills are sent on update", () => {
    expect(
      toVacancySkillsAttributes([
        { id: 9, skill_id: "SK-ENG-001", skill_label: "React", expected_level: 3, _destroy: true },
      ])
    ).toEqual([
      { id: 9, skill_id: "SK-ENG-001", skill_label: "React", expected_level: 3, _destroy: true },
    ]);
  });

  it("drops blank labels and nulls skill_id for custom rows", () => {
    expect(
      toVacancySkillsAttributes([
        { skill_label: "  ", expected_level: 3 },
        { skill_label: " Domain Ownership ", expected_level: 4 },
        { skill_id: "SK-ENG-001", skill_label: "React", expected_level: 3 },
      ])
    ).toEqual([
      { skill_id: null, skill_label: "Domain Ownership", expected_level: 4 },
      { skill_id: "SK-ENG-001", skill_label: "React", expected_level: 3 },
    ]);
  });
});
