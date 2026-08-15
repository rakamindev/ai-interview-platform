import { describe, it, expect } from "vitest";
import { skillComparisonSchema, fitGapReportSchema, parseOrThrow, ContractError } from "../schemas";

const validComparison = {
  skill_label: "Distributed Systems",
  skill_id: "sk-eng-001",
  required_level: 3,
  expected_level: 3,
  candidate_level: 4,
  ai_level: 2,
  override_level: 4,
  is_override: true,
  confidence: "high",
  assessment_state: "assessed",
  result: "exceed",
  delta: 1,
  in_vacancy: true,
};

describe("skillComparisonSchema", () => {
  it("accepts the payload FitGap::Engine emits", () => {
    expect(parseOrThrow(skillComparisonSchema, validComparison, "comparison").required_level).toBe(3);
  });

  // The regression guard. The API used to send `expected_level` while the table
  // read `required_level`, and the result was an empty cell rather than an
  // error — which is exactly why the bug survived. This must now throw.
  it("rejects a payload that omits required_level instead of yielding undefined", () => {
    const { required_level, ...missing } = validComparison;
    void required_level;

    expect(() => parseOrThrow(skillComparisonSchema, missing, "comparison")).toThrow(ContractError);
  });

  it("names the offending field so a contract drift is diagnosable", () => {
    const { required_level, ...missing } = validComparison;
    void required_level;

    expect(() => parseOrThrow(skillComparisonSchema, missing, "comparison")).toThrow(/required_level/);
  });

  it("rejects a level outside 1..5 rather than rendering it", () => {
    expect(() =>
      parseOrThrow(skillComparisonSchema, { ...validComparison, candidate_level: 9 }, "comparison"),
    ).toThrow(ContractError);
  });

  it("allows a null candidate level, which is how an unassessed skill arrives", () => {
    const parsed = parseOrThrow(
      skillComparisonSchema,
      { ...validComparison, candidate_level: null, result: "not_assessed", delta: null, assessment_state: "not_probed" },
      "comparison",
    );

    expect(parsed.candidate_level).toBeNull();
    expect(parsed.result).toBe("not_assessed");
  });

  it("allows a null required_level for a skill outside the vacancy", () => {
    const parsed = parseOrThrow(
      skillComparisonSchema,
      { ...validComparison, required_level: null, expected_level: null, result: "additional", delta: null, in_vacancy: false },
      "comparison",
    );

    expect(parsed.in_vacancy).toBe(false);
  });
});

describe("fitGapReportSchema", () => {
  const report = {
    id: 1,
    portfolio_id: 2,
    vacancy_id: 3,
    skill_comparisons: [validComparison],
    culture_narrative: null,
    overall_narrative: "Automated summary (narrative generation unavailable): 1 match.",
    narrative_status: "failed",
    generated_at: "2026-08-15T10:00:00Z",
  };

  it("preserves narrative_status so a failure is not inferred from a null", () => {
    expect(parseOrThrow(fitGapReportSchema, report, "fit/gap report").narrative_status).toBe("failed");
  });
});
