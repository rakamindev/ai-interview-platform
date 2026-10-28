import axios from "axios";
import { describe, expect, it } from "vitest";
import { fitGapDemoAdapter } from "@/mocks/fitGapDemoAdapter";

describe("Fit/Gap demo API adapter", () => {
  it("serves assessment, candidate sessions, vacancies, and engine-shaped reports", async () => {
    const demoApi = axios.create({ adapter: fitGapDemoAdapter });
    const [assessments, sessions, vacancies, report] = await Promise.all([
      demoApi.get("/assessments"),
      demoApi.get("/assessments/101/sessions"),
      demoApi.get("/vacancies"),
      demoApi.get("/portfolios/801/fitgap/901"),
    ]);

    expect(assessments.data.assessments).toHaveLength(1);
    expect(sessions.data.sessions.length).toBeGreaterThan(1);
    expect(vacancies.data.vacancies.length).toBeGreaterThan(1);
    expect(report.data.report.skill_comparisons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skill_label: "React and TypeScript",
          expected_level: 3,
          candidate_level: 4,
          overridden: true,
        }),
        expect.objectContaining({
          result: "not_assessed",
          candidate_level: null,
        }),
      ])
    );
  });
});
