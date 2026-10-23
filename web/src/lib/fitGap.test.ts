import { describe, expect, it } from "vitest";
import { levelSource, resultExplanation, resultMeta, summarize, summarySentence } from "./fitGap";
import { comparison, needsReview, notCovered } from "@/test/fixtures";

describe("summarize", () => {
  it("counts open questions separately from verdicts", () => {
    const s = summarize([
      comparison({ result: "gap", delta: -1 }),
      comparison({ result: "exceed", delta: 1 }),
      needsReview(),
      notCovered(),
    ]);

    expect(s).toEqual({ total: 4, meets: 1, below: 1, review: 1, notCovered: 1, rated: 2, open: 2 });
  });

  it("never counts a needs-review skill as below expected", () => {
    expect(summarize([needsReview({ provisional_result: "gap" })]).below).toBe(0);
  });
});

describe("summarySentence", () => {
  it("names open questions as not evidence of weakness", () => {
    expect(summarySentence(summarize([comparison(), needsReview(), notCovered()]))).toBe(
      "1 of 3 required skills rated with enough evidence. 2 are open questions, not evidence of weakness.",
    );
  });

  it("is short when nothing is open", () => {
    expect(summarySentence(summarize([comparison()]))).toBe("1 of 1 required skill rated with enough evidence.");
  });
});

describe("resultMeta", () => {
  it.each([
    [comparison({ result: "gap", delta: -2 }), "Below by 2", "negative"],
    [needsReview(), "Needs review", "attention"],
    [notCovered(), "Not covered", "neutral"],
    [comparison(), "Meets", "positive"],
    [comparison({ result: "exceed", delta: 1 }), "Exceeds by 1", "positive"],
  ])("labels %#", (c, label, tone) => {
    expect(resultMeta(c)).toEqual({ label, tone });
  });
});

describe("resultExplanation", () => {
  it("shows the provisional AI level and its direction for a skill that needs review", () => {
    expect(resultExplanation(needsReview())).toMatch(/AI suggested L2 \(below the expected L4\)/);
  });

  it("says an uncovered skill is not a weakness", () => {
    expect(resultExplanation(notCovered())).toMatch(/not evidence of weakness/);
  });

  it("adds nothing to a confirmed verdict", () => {
    expect(resultExplanation(comparison())).toBeNull();
  });
});

describe("levelSource", () => {
  it("prefers the assessor over the AI", () => {
    expect(levelSource(comparison({ overridden: true }))).toBe("Assessor-confirmed");
    expect(levelSource(comparison({ confidence: "medium" }))).toBe("AI · medium confidence");
    expect(levelSource(needsReview())).toBeNull();
  });
});
