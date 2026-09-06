import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import UnassessedSkillsSection from "./UnassessedSkillsSection";
import type { PortfolioSkill } from "@/types";

describe("UnassessedSkillsSection (GAP-02)", () => {
  it("renders nothing when no unassessed skills exist", () => {
    const { container } = render(
      <UnassessedSkillsSection
        skills={[]}
        overrides={{}}
        onOverrideSaved={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the transparent container with warning title when unassessed skills exist", () => {
    const unassessedSkills: PortfolioSkill[] = [
      {
        id: 101,
        portfolio_id: 18,
        skill_id: 5,
        skill_label: "Kubernetes",
        ai_level: 0,
        ai_confidence: "low",
        evidence: [],
        competency_summary: "Skill was not probed during this session.",
        is_discovered: false,
      },
    ];

    render(
      <UnassessedSkillsSection
        skills={unassessedSkills}
        overrides={{}}
        onOverrideSaved={vi.fn()}
      />
    );

    expect(screen.getByText(/Configured Skills Not Probed During Session/i)).toBeDefined();
    expect(screen.getByText("Kubernetes")).toBeDefined();
    expect(screen.getByText("Skill was not probed during this session.")).toBeDefined();
  });
});
