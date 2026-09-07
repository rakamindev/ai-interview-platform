import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NotAssessedPanel from "@/components/portfolio/NotAssessedPanel";
import type { NotAssessedSkill } from "@/types";

const skill = (overrides: Partial<NotAssessedSkill> = {}): NotAssessedSkill => ({
  skill_id: "sk-eng-002",
  skill_label: "System Design",
  expected_level: 4,
  coverage_state: "not_yet",
  reason: "not_discussed",
  ...overrides,
});

describe("NotAssessedPanel", () => {
  it("renders nothing when every configured skill was scored", () => {
    const { container } = render(<NotAssessedPanel skills={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("names the skill the interview never reached, so it cannot be read as a weakness", () => {
    render(<NotAssessedPanel skills={[skill()]} />);

    expect(screen.getByText("System Design")).toBeInTheDocument();
    expect(screen.getByText(/never discussed/i)).toBeInTheDocument();
    expect(screen.getByText(/gaps in the interview, not gaps in the candidate/i)).toBeInTheDocument();
  });

  it("distinguishes a skill that was discussed but came back without a usable rating", () => {
    render(<NotAssessedPanel skills={[skill({ reason: "no_rating", coverage_state: "partial" })]} />);

    expect(screen.getByText(/no usable rating/i)).toBeInTheDocument();
    expect(screen.queryByText(/never discussed/i)).not.toBeInTheDocument();
  });

  it("shows what the role expected so the assessor sees the size of the gap", () => {
    render(<NotAssessedPanel skills={[skill()]} />);

    expect(screen.getByText(/role expects l4/i)).toBeInTheDocument();
  });

  it("omits the expected level when the role never set one", () => {
    render(<NotAssessedPanel skills={[skill({ expected_level: null })]} />);

    expect(screen.queryByText(/role expects/i)).not.toBeInTheDocument();
  });
});
