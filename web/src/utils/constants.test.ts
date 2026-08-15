import { describe, it, expect } from "vitest";
import { parseLevel } from "./constants";

describe("parseLevel", () => {
  it("passes a plain number through unchanged", () => {
    expect(parseLevel(3)).toBe(3);
  });

  it("extracts the digit from a simple label", () => {
    expect(parseLevel("L3")).toBe(3);
  });

  it("extracts a level embedded in a descriptive string", () => {
    expect(parseLevel("3 (Intermediate)")).toBe(3);
  });

  it("passes a number through even if out of the normal 1-5 range", () => {
    // No clamping here: the backend already validates ai_level to 1-5 for
    // any assessed skill before it ever reaches the frontend, so this just
    // documents that parseLevel itself isn't the safety net for that.
    expect(parseLevel(9)).toBe(9);
  });

  // Regression: assessment/gap-analysis.md P0-4 — the old implementation did
  // `level.replace(...)` and fell back to 1 on failure, which silently
  // turned "no data" into "lowest possible score". null/undefined/unparseable
  // must return null, never a fabricated level.
  it("returns null instead of a fabricated level for null", () => {
    expect(parseLevel(null)).toBeNull();
  });

  it("returns null instead of a fabricated level for undefined", () => {
    expect(parseLevel(undefined)).toBeNull();
  });

  it("returns null for a string with no digits", () => {
    expect(parseLevel("unknown")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseLevel("")).toBeNull();
  });
});
