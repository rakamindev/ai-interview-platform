import { describe, expect, it } from "vitest";
import { FIT_GAP_RESULT_LABELS, LEVEL_DESCRIPTIONS, LEVEL_LABELS, parseLevel } from "./constants";

describe("parseLevel", () => {
  it("reads a level from a number, a digit string or an L-prefixed string", () => {
    expect(parseLevel(3)).toBe(3);
    expect(parseLevel("3")).toBe(3);
    expect(parseLevel("L4")).toBe(4);
  });

  // AC-23: only a whole level from 1 to 5 counts. Anything else is "no level", never L1.
  it.each([
    [3, 3], ["3", 3], ["L3", 3], ["l3", 3], [" L3 ", 3], [3.0, 3], [1, 1], ["L5", 5],
  ])("reads %j as level %i (AC-23)", (input, expected) => {
    expect(parseLevel(input)).toBe(expected);
  });

  it.each([
    [null], [undefined], [""], ["N/A"], ["high"], ["L"], ["L0"], ["L6"], ["0"], ["6"], ["12"], ["L3.5"],
    [0], [6], [-1], [2.5], [NaN], [true], [[]], [{}],
  ])("treats %j as no level (AC-23)", (input) => {
    expect(parseLevel(input)).toBeNull();
  });

  describe("known defects (P0-1, P2-11)", () => {
    // Anything unreadable becomes L1, the same fabricated rating as the API's clamp.
    it("does not turn an unreadable level into L1", () => {
      expect(parseLevel("N/A")).toBeNull();
    });

    // A missing level throws (null.replace), which takes down the portfolio page.
    it("treats a missing level as no level instead of throwing", () => {
      expect(parseLevel(null as unknown as string)).toBeNull();
    });
  });
});

describe("level and result labels", () => {
  it("has a label and a description for every level from 1 to 5", () => {
    for (const level of [1, 2, 3, 4, 5]) {
      expect(LEVEL_LABELS[level]).toBe(`L${level}`);
      expect(LEVEL_DESCRIPTIONS[level]).toBeTruthy();
    }
  });

  it("has a label for every fit/gap result the API can return", () => {
    expect(Object.keys(FIT_GAP_RESULT_LABELS).sort()).toEqual(["exceed", "gap", "match", "not_assessed"]);
  });
});
