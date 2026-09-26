import { describe, it, expect } from "vitest";

function detectDuplicateSkills(skills: Array<{ skill_label?: string }>): string | null {
  const labels = skills.map((s) => s.skill_label?.trim().toLowerCase()).filter(Boolean);
  const duplicate = labels.find((lbl, idx) => labels.indexOf(lbl) !== idx);
  if (duplicate) {
    return skills.find((s) => s.skill_label?.trim().toLowerCase() === duplicate)?.skill_label || duplicate;
  }
  return null;
}

function isSkillAlreadySelected(candidateLabel: string, selectedLabels: string[]): boolean {
  if (!selectedLabels || selectedLabels.length === 0) return false;
  const normalized = candidateLabel.trim().toLowerCase();
  return selectedLabels.some((l) => l.trim().toLowerCase() === normalized);
}

describe("Skill Validation & Duplicate Prevention Logic", () => {
  it("detects exact duplicate skill labels", () => {
    const list = [
      { skill_label: "React" },
      { skill_label: "PostgreSQL" },
      { skill_label: "React" },
    ];
    expect(detectDuplicateSkills(list)).toBe("React");
  });

  it("detects case-insensitive and whitespace duplicate skill labels", () => {
    const list = [
      { skill_label: "Ruby on Rails" },
      { skill_label: "  ruby on rails  " },
    ];
    expect(detectDuplicateSkills(list)).toBeTruthy();
  });

  it("returns null when all skill labels are unique", () => {
    const list = [
      { skill_label: "React" },
      { skill_label: "TypeScript" },
      { skill_label: "Ruby on Rails" },
    ];
    expect(detectDuplicateSkills(list)).toBeNull();
  });

  it("correctly identifies already selected skills for SkillPicker disabling", () => {
    const selected = ["React", "Ruby on Rails"];
    expect(isSkillAlreadySelected("react", selected)).toBe(true);
    expect(isSkillAlreadySelected("  RUBY ON RAILS  ", selected)).toBe(true);
    expect(isSkillAlreadySelected("PostgreSQL", selected)).toBe(false);
  });
});

