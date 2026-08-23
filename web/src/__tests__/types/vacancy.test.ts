import { describe, it, expect } from "vitest";
import type { VacancySkill } from "@/types";

describe("VacancySkill type", () => {
  it("allows string skill_id", () => {
    const skill: VacancySkill = {
      skill_id: "SK-ENG-001",
      skill_label: "Software Engineering",
      expected_level: 4,
    };
    expect(skill.skill_id).toBe("SK-ENG-001");
  });

  it("allows undefined skill_id for custom skills", () => {
    const skill: VacancySkill = {
      skill_label: "Custom Skill",
      expected_level: 3,
    };
    expect(skill.skill_id).toBeUndefined();
  });
});
