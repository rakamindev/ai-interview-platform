import { describe, expect, it } from "vitest";

import { getInitials, toTitleCase } from "./string";

describe("getInitials", () => {
  it("renders initials from a full name", () => {
    expect(getInitials("Adi Rizky", 2)).toBe("AR");
  });

  it("strips surrounding whitespace", () => {
    expect(getInitials("  budi santoso  ", 2)).toBe("BS");
  });

  it("collapses multiple spaces", () => {
    expect(getInitials("Budi    Santoso", 2)).toBe("BS");
  });

  it("limits initials to requested length", () => {
    expect(getInitials("Adi Rizky Pratama", 2)).toBe("AR");
  });

  it("handles single-word names", () => {
    expect(getInitials("Budi", 2)).toBe("B");
  });

  it("handles empty string", () => {
    expect(getInitials("", 2)).toBe("");
  });
});

describe("toTitleCase", () => {
  it("title-cases a lowercase string", () => {
    expect(toTitleCase("ruby on rails")).toBe("Ruby On Rails");
  });

  it("normalizes mixed case", () => {
    expect(toTitleCase("REACT NATIVE")).toBe("React Native");
  });

  it("handles single word", () => {
    expect(toTitleCase("typescript")).toBe("Typescript");
  });

  it("handles empty string", () => {
    expect(toTitleCase("")).toBe("");
  });
});