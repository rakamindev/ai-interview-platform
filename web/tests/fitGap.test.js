import test from "node:test";
import assert from "node:assert/strict";
import { summarizeComparisons } from "../src/utils/fitGap.ts";

test("does not count an unassessed skill as a positive decision signal", () => {
  const summary = summarizeComparisons([
    { skill_label: "React", required_level: 3, candidate_level: 3, result: "match" },
    { skill_label: "Ruby", required_level: 3, candidate_level: null, result: "not_assessed" },
  ]);

  assert.deepEqual(summary, {
    total: 2,
    assessed: 1,
    matches: 1,
    gaps: 0,
    exceeds: 0,
    notAssessed: 1,
    positiveRate: 100,
  });
});

test("returns a neutral rate when a vacancy has no comparable skills", () => {
  assert.deepEqual(summarizeComparisons([]), {
    total: 0,
    assessed: 0,
    matches: 0,
    gaps: 0,
    exceeds: 0,
    notAssessed: 0,
    positiveRate: null,
  });
});
