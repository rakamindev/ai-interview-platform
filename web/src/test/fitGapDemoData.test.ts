import { describe, expect, it } from "vitest";
import { demoPortfolios, demoReports, demoSessions, demoVacancies } from "@/mocks/fitGapDemoData";

describe("Fit/Gap demo fixtures", () => {
  it("provides several fictional candidates and vacancies", () => {
    expect(demoSessions.length).toBeGreaterThan(1);
    expect(demoVacancies.length).toBeGreaterThan(1);
    expect(demoSessions.every((session) => session.candidate_name?.startsWith("Kandidat Contoh "))).toBe(true);
  });

  it("matches the FitGap::Engine comparison payload and covers defensive edge cases", () => {
    const comparisons = Object.values(demoReports).flatMap((report) => report.skill_comparisons);

    expect(comparisons.every((row) => (
      "skill_label" in row
      && "candidate_level" in row
      && "expected_level" in row
      && "delta" in row
      && "result" in row
      && "overridden" in row
      && "skill_id" in row
      && "confidence" in row
    ))).toBe(true);
    expect(comparisons.some((row) => row.expected_level === null)).toBe(true);
    expect(comparisons.some((row) => row.overridden === true)).toBe(true);
    expect(comparisons.some((row) => row.result === "not_assessed" && row.candidate_level === null)).toBe(true);
    expect(comparisons.some((row) => row.skill_label.length > 60)).toBe(true);
    expect(Object.keys(demoPortfolios).length).toBeGreaterThan(1);
  });
});
