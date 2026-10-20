import { countResults, isAssessed, sortAssessedFirst, summarizeSkills } from "./skills";
import { buildComparison, buildSkill, buildUnratedSkill } from "@/test/factories";

describe("isAssessed", () => {
  it("is false for a skill without a level, whatever its status says", () => {
    expect(isAssessed(buildSkill({ ai_level: null }))).toBe(false);
    expect(isAssessed(buildUnratedSkill())).toBe(false);
    expect(isAssessed(buildSkill())).toBe(true);
  });
});

describe("summarizeSkills", () => {
  it("counts only configured skills", () => {
    const skills = [buildSkill(), buildUnratedSkill(), buildSkill({ id: 3, is_discovered: true })];

    expect(summarizeSkills(skills)).toEqual({ rated: 1, total: 2, unrated: 1 });
  });
});

describe("sortAssessedFirst", () => {
  it("puts rated skills before unrated ones without mutating the input", () => {
    const skills = [buildUnratedSkill(), buildSkill()];

    expect(sortAssessedFirst(skills).map((s) => s.skill_label)).toEqual(["System Design", "Testing"]);
    expect(skills[0].skill_label).toBe("Testing");
  });
});

describe("countResults", () => {
  it("counts not assessed separately from gaps", () => {
    const counts = countResults([
      buildComparison(),
      buildComparison({ result: "gap", delta: -1 }),
      buildComparison({ result: "not_assessed", candidate_level: null, delta: null }),
    ]);

    expect(counts).toEqual({ match: 1, gap: 1, exceed: 0, notAssessed: 1 });
  });
});
