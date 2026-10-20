import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SkillPortfolioCard from "./SkillPortfolioCard";
import { buildSkill, buildUnratedSkill } from "@/test/factories";

describe("SkillPortfolioCard", () => {
  it("shows the level and lets the assessor adjust it for a rated skill", () => {
    render(<SkillPortfolioCard skill={buildSkill()} onOverrideSaved={() => {}} />);

    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText("High confidence")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adjust rating" })).toBeInTheDocument();
  });

  it("never shows a level for a skill that was not assessed", () => {
    render(<SkillPortfolioCard skill={buildUnratedSkill()} onOverrideSaved={() => {}} />);

    expect(screen.getByLabelText("No rating")).toBeInTheDocument();
    expect(screen.queryByText(/^L[1-5]$/)).not.toBeInTheDocument();
    expect(screen.getByText("Not assessed")).toBeInTheDocument();
    expect(screen.getByText(/ended before this skill came up/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adjust rating" })).not.toBeInTheDocument();
  });

  it("explains insufficient evidence and keeps what was discussed", () => {
    const skill = buildUnratedSkill({
      assessment_status: "insufficient_evidence",
      competency_summary: "Mentioned unit tests once.",
    });

    render(<SkillPortfolioCard skill={skill} onOverrideSaved={() => {}} />);

    expect(screen.getByText("Not enough evidence")).toBeInTheDocument();
    expect(screen.getByText("What was discussed")).toBeInTheDocument();
    expect(screen.getByText("Mentioned unit tests once.")).toBeInTheDocument();
  });

  it("collapses long evidence quotes until expanded", async () => {
    const longQuote = "We profiled the checkout flow. ".repeat(20);
    render(<SkillPortfolioCard skill={buildSkill({ evidence: [longQuote] })} onOverrideSaved={() => {}} />);

    expect(screen.queryByText(`“${longQuote}”`, { exact: false })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Show more" }));

    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();
  });

  it("shows the assessor's level instead of the AI level when adjusted", () => {
    const override = { id: 9, portfolio_skill_id: 1, ai_level: 3, override_level: 4, assessor_notes: "" };

    render(<SkillPortfolioCard skill={buildSkill()} override={override} onOverrideSaved={() => {}} />);

    expect(screen.getByText("Adjusted by assessor")).toBeInTheDocument();
    expect(screen.getAllByText("L4").length).toBeGreaterThan(0);
  });
});
