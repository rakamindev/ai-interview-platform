import { describe, expect, it } from "vitest";
import { apiErrorMessages } from "./apiErrors";
import { parseLevel } from "./constants";

describe("parseLevel", () => {
  it.each([
    ["L3", 3],
    ["l5", 5],
    ["2", 2],
    [4, 4],
    ["unknown", 1],
  ] as const)("parses %s as %i", (input, expected) => {
    expect(parseLevel(input)).toBe(expected);
  });
});

describe("apiErrorMessages", () => {
  it("returns non-empty API messages and ignores malformed entries", () => {
    expect(apiErrorMessages({
      response: { data: { errors: [{ message: "Denied" }, null, { message: " " }, { message: 4 }] } },
    }, "Fallback")).toEqual(["Denied"]);
  });

  it("uses the fallback when the response has no useful errors", () => {
    expect(apiErrorMessages(new Error("network"), "Try again")).toEqual(["Try again"]);
  });
});
