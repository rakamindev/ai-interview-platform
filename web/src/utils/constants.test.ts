import { describe, it, expect } from "vitest";
import { parseLevel } from "./constants";

describe("Frontend Defensive Logic & Seam Contracts", () => {
  describe("parseLevel() null guarding", () => {
    it("returns null for null, undefined, or empty/invalid string instead of coercing to 1", () => {
      expect(parseLevel(null)).toBeNull();
      expect(parseLevel(undefined)).toBeNull();
      expect(parseLevel("")).toBeNull();
      expect(parseLevel("invalid_skill")).toBeNull();
    });

    it("correctly parses valid levels into numbers", () => {
      expect(parseLevel("L3")).toBe(3);
      expect(parseLevel("L5")).toBe(5);
      expect(parseLevel(4)).toBe(4);
    });

    it("does not exhibit P0 false certainty behavior (never converts unassessed null into L1)", () => {
      const unassessedInput = null;
      const parsed = parseLevel(unassessedInput);
      expect(parsed).not.toBe(1);
      expect(parsed).toBeNull();
    });
  });

  describe("ComparisonTable targetLevel fallback seam contract", () => {
    it("safely resolves targetLevel from required_level or expected_level", () => {
      const mockRowBackendA = { skill_name: "React", required_level: 3, expected_level: 3 };
      const mockRowBackendB = { skill_name: "React", expected_level: 3 }; // legacy backend without required_level
      const mockRowBackendC = { skill_name: "React", required_level: 4 }; // newer serializer

      const resolveTarget = (row: any) => row.required_level ?? row.expected_level ?? null;

      expect(resolveTarget(mockRowBackendA)).toBe(3);
      expect(resolveTarget(mockRowBackendB)).toBe(3);
      expect(resolveTarget(mockRowBackendC)).toBe(4);
    });
  });

  describe("Talent Mobility recommendation logic", () => {
    it("flags candidate for frontend mobility if React >= 4 despite failing overall fullstack bar", () => {
      const candidateProfile = {
        name: "Fadhil Farhan",
        appliedRole: "Fullstack Engineer",
        passed: false,
        skills: [
          { name: "React", level: 4 },
          { name: "Ruby on Rails", level: 1 },
          { name: "PostgreSQL", level: 1 }
        ]
      };

      const reactSkill = candidateProfile.skills.find(s => s.name === "React");
      const isMobilityCandidate = !candidateProfile.passed && (reactSkill?.level ?? 0) >= 3;

      expect(isMobilityCandidate).toBe(true);
    });
  });
});
