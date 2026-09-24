import assert from "node:assert/strict";
import test from "node:test";
import { fitGapReportSchema, skillComparisonSchema } from "../node_modules/.cache/fitgap-contract-test/contracts.js";

test("accepts the canonical expected_level and explicit override flag", () => {
  const result = skillComparisonSchema.safeParse({
    skill_label: "Architecture",
    candidate_level: 3,
    expected_level: 4,
    result: "gap",
    delta: -1,
    confidence: "medium",
    is_override: true,
  });
  assert.equal(result.success, true);
});

test("rejects the old required_level field and missing is_override", () => {
  const result = skillComparisonSchema.safeParse({
    skill_label: "Architecture",
    candidate_level: 3,
    required_level: 4,
    result: "gap",
    delta: -1,
  });
  assert.equal(result.success, false);
});

test("accepts explicit null for a not-assessed skill, but rejects numeric strings", () => {
  const notAssessed = skillComparisonSchema.safeParse({
    skill_label: "Architecture",
    candidate_level: null,
    expected_level: 4,
    result: "not_assessed",
    delta: null,
    is_override: false,
  });
  const wrongType = skillComparisonSchema.safeParse({
    skill_label: "Architecture",
    candidate_level: "3",
    expected_level: 4,
    result: "gap",
    delta: -1,
    is_override: false,
  });
  assert.equal(notAssessed.success, true);
  assert.equal(wrongType.success, false);
});

test("validates report envelope and skill collection at runtime", () => {
  const result = fitGapReportSchema.safeParse({
    id: 1,
    portfolio_id: 2,
    vacancy_id: 3,
    skill_comparisons: [{
      skill_label: "Architecture",
      candidate_level: null,
      expected_level: null,
      result: "not_assessed",
      delta: null,
      is_override: false,
    }],
    culture_narrative: null,
    overall_narrative: "Review the evidence with an assessor.",
    generated_at: "2026-09-24T10:00:00Z",
  });
  assert.equal(result.success, true);
});
