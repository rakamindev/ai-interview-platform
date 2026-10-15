import { describe, expect, it } from "vitest";
import { parseLevel } from "../constants";

describe("parseLevel", () => {
  it("passes numbers 1-5 through", () => {
    expect(parseLevel(3)).toBe(3);
  });

  it("parses the L-prefixed form", () => {
    expect(parseLevel("L4")).toBe(4);
  });

  it.each([null, undefined, "", "L0", 6, 2.5, "three"])("returns null for %p instead of defaulting to L1", (value) => {
    expect(parseLevel(value as never)).toBeNull();
  });
});
