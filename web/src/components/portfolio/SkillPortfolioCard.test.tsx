import { render, screen } from "@testing-library/react";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import type { PortfolioSkill } from "@/types";

const notAssessedSkill: PortfolioSkill = {
  id: 1,
  skill_label: "GraphQL",
  is_discovered: false,
  assessment_status: "not_assessed",
  ai_level: null,
  ai_confidence: null,
  evidence: [],
  competency_summary: "Not discussed in this session.",
  coverage_state: "not_yet",
  probe_count: 0,
};

describe("SkillPortfolioCard", () => {
  it("renders not assessed without a level badge", () => {
    render(
      <SkillPortfolioCard skill={notAssessedSkill} onOverrideSaved={() => {}} />
    );
    expect(screen.getByText("Not assessed")).toBeInTheDocument();
    expect(screen.queryByText("L1")).not.toBeInTheDocument();
    expect(screen.getByText(/not discussed enough/i)).toBeInTheDocument();
  });
});
