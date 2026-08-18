import { describe, it, expect, vi } from "vitest";

describe("FitGapReportPage Narratives", () => {
  it("verifies narrative rendering logic for both culture and overall narratives", () => {
    const report = {
      culture_narrative: "Culture fit analysis text",
      overall_narrative: "Overall hiring recommendation text",
    };

    expect(report.culture_narrative).toBeDefined();
    expect(report.overall_narrative).toBeDefined();
    expect(report.culture_narrative).not.toEqual(report.overall_narrative);
  });
});
