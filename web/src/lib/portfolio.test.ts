import { describe, expect, it } from "vitest";
import {
  comparisonNeedsReview,
  effectiveLevel,
  isAssessed,
  needsReview,
  notAssessedCopy,
  requiredLevel,
  summarizePortfolio,
  toLevel,
} from "./portfolio";
import { comparison, notAssessed, override, skill } from "@/test/fixtures";

describe("toLevel", () => {
  it.each([
    [3, 3],
    ["L4", 4],
    ["l2", 2],
    [" 5 ", 5],
    [null, null],
    [undefined, null],
    [0, null],
    [6, null],
    [2.5, null],
    ["L3-L4", null],
    ["high", null],
  ])("%j → %j (never invents a level)", (input, expected) => {
    expect(toLevel(input as never)).toBe(expected);
  });
});

describe("assessment state", () => {
  it("treats skills from older payloads without a status as assessed", () => {
    expect(isAssessed(skill({ assessment_status: undefined }))).toBe(true);
  });

  it("is not assessed when the status says so or the level is missing", () => {
    expect(isAssessed(notAssessed())).toBe(false);
    expect(isAssessed(skill({ ai_level: null }))).toBe(false);
  });

  it("uses the assessor's level over the AI's, and null when nobody rated it", () => {
    expect(effectiveLevel(skill(), override({ override_level: 5 }))).toBe(5);
    expect(effectiveLevel(notAssessed())).toBeNull();
    expect(effectiveLevel(notAssessed(), override())).toBe(3);
  });
});

describe("needsReview", () => {
  it("flags unassessed, low-confidence and unverified ratings", () => {
    expect(needsReview(notAssessed())).toBe(true);
    expect(needsReview(skill({ ai_confidence: "low" }))).toBe(true);
    expect(needsReview(skill({ evidence: [], evidence_refs: [] }))).toBe(true);
    expect(needsReview(skill())).toBe(false);
  });

  it("is settled once an assessor rates the skill", () => {
    expect(needsReview(notAssessed(), override())).toBe(false);
  });
});

describe("summarizePortfolio", () => {
  it("counts configured skills only", () => {
    const skills = [skill(), notAssessed(), skill({ id: 3, is_discovered: true, ai_confidence: "low" })];
    expect(summarizePortfolio(skills, {})).toEqual({
      total: 2, assessed: 1, notAssessed: 1, needsReview: 1, overridden: 0,
    });
    expect(summarizePortfolio(skills, { 2: override() })).toMatchObject({ assessed: 2, notAssessed: 0, overridden: 1 });
  });
});

describe("fit/gap rows", () => {
  it("reads required_level, falling back to expected_level from older reports", () => {
    expect(requiredLevel(comparison({ required_level: 4 }))).toBe(4);
    expect(requiredLevel(comparison({ required_level: undefined, expected_level: 2 }))).toBe(2);
  });

  it("derives needs_review for older reports that lack the flag", () => {
    expect(comparisonNeedsReview(comparison({ needs_review: undefined, result: "not_assessed" }))).toBe(true);
    expect(comparisonNeedsReview(comparison({ needs_review: undefined, confidence: "low" }))).toBe(true);
    expect(comparisonNeedsReview(comparison({ needs_review: undefined, confidence: "low", is_override: true }))).toBe(false);
  });

  it("never describes a missing rating as a low score", () => {
    expect(notAssessedCopy("never_reached").body).toMatch(/not a low score/);
    expect(notAssessedCopy(undefined).title).toBe("Not reached in the interview");
  });
});
