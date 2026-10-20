import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ComparisonTable from "./ComparisonTable";
import EvidenceGapsNotice from "./EvidenceGapsNotice";
import { comparison } from "@/test/fixtures";

function desktopTable() {
  return screen.getByRole("table");
}

describe("ComparisonTable", () => {
  // Regression (F-002): the column read `required_level`, which the API never sends, so it was always blank.
  it("shows the required level from expected_level", () => {
    render(<ComparisonTable comparisons={[comparison({ expected_level: 4, candidate_level: 2, result: "gap", delta: -2 })]} />);

    const row = within(desktopTable()).getByRole("row", { name: /React/ });
    expect(within(row).getByText("L4")).toBeInTheDocument();
    expect(within(row).getByText("L2")).toBeInTheDocument();
    expect(within(row).getByText("Below")).toBeInTheDocument();
    expect(within(row).getByText("by 2 levels")).toBeInTheDocument();
  });

  it("marks rows where an assessor's rating was used", () => {
    render(<ComparisonTable comparisons={[comparison({ is_override: true, candidate_level: 4, ai_level: null, result: "exceed", delta: 1 })]} />);

    const row = within(desktopTable()).getByRole("row", { name: /React/ });
    expect(within(row).getByText("Assessor")).toBeInTheDocument();
  });

  it("shows a not-assessed skill as missing evidence, not as a gap", () => {
    render(
      <ComparisonTable
        comparisons={[comparison({ skill_label: "Cloud", candidate_level: null, ai_level: null, result: "not_assessed", delta: null, confidence: null })]}
      />,
    );

    const row = within(desktopTable()).getByRole("row", { name: /Cloud/ });
    expect(within(row).getAllByText("No evidence")).toHaveLength(2); // candidate column and result
    expect(within(row).queryByText("Below")).not.toBeInTheDocument();
    expect(within(row).getByRole("img", { name: "No evidence, required L3" })).toBeInTheDocument();
  });

  it("counts every result in the summary, including missing evidence", () => {
    render(
      <ComparisonTable
        comparisons={[
          comparison({ skill_label: "A" }),
          comparison({ skill_label: "B", result: "gap", candidate_level: 1, delta: -2 }),
          comparison({ skill_label: "C", result: "not_assessed", candidate_level: null, delta: null }),
        ]}
      />,
    );

    expect(screen.getByText("meets").parentElement).toHaveTextContent("1 meets");
    expect(screen.getByText("below").parentElement).toHaveTextContent("1 below");
    expect(screen.getByText("no evidence").parentElement).toHaveTextContent("1 no evidence");
  });

  it("also renders a stacked list for narrow screens", () => {
    render(<ComparisonTable comparisons={[comparison()]} />);

    expect(within(screen.getByRole("list", { name: "Skill comparison" })).getByText("React")).toBeInTheDocument();
  });
});

describe("EvidenceGapsNotice", () => {
  it("explains each reason the recommendation was withheld, with a way to resolve it", () => {
    render(
      <MemoryRouter>
        <EvidenceGapsNotice
          portfolioPath="/portfolio"
          vacancyEditPath="/vacancies/2/edit"
          gaps={[
            { reason: "skills_not_assessed", skills: ["Cloud", "SQL"] },
            { reason: "low_confidence", skills: ["TypeScript"] },
            { reason: "interview_incomplete", skills: [], end_reason: "manual_candidate" },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "No recommendation yet" })).toBeInTheDocument();
    expect(screen.getByText(/Cloud, SQL/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rate them on the portfolio" })).toHaveAttribute("href", "/portfolio");
    expect(screen.getByText(/TypeScript/)).toBeInTheDocument();
    expect(screen.getByText(/the candidate ended it/)).toBeInTheDocument();
  });

  it("points to the vacancy when it has no skills", () => {
    render(
      <MemoryRouter>
        <EvidenceGapsNotice portfolioPath="/p" vacancyEditPath="/vacancies/2/edit" gaps={[{ reason: "no_vacancy_skills", skills: [] }]} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Add skills to the vacancy" })).toHaveAttribute("href", "/vacancies/2/edit");
  });
});
