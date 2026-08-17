import { describe, it, expect } from "vitest";
import { VERDICT_BADGE_CLASSES, VERDICT_LABELS } from "@/utils/verdictBadge";

describe("verdictBadge", () => {
  it("defines badge classes and labels for every verdict value", () => {
    (["pass", "consider", "failed"] as const).forEach((verdict) => {
      expect(VERDICT_BADGE_CLASSES[verdict]).toBeTruthy();
      expect(VERDICT_LABELS[verdict]).toBeTruthy();
    });
  });

  it("maps pass to a green class and a capitalized label", () => {
    expect(VERDICT_BADGE_CLASSES.pass).toContain("green");
    expect(VERDICT_LABELS.pass).toBe("Pass");
  });

  it("maps consider to an amber class and a capitalized label", () => {
    expect(VERDICT_BADGE_CLASSES.consider).toContain("amber");
    expect(VERDICT_LABELS.consider).toBe("Consider");
  });

  it("maps failed to a red class and a capitalized label", () => {
    expect(VERDICT_BADGE_CLASSES.failed).toContain("red");
    expect(VERDICT_LABELS.failed).toBe("Failed");
  });
});
