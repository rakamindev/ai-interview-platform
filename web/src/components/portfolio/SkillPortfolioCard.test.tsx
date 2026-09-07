import { render, screen } from "@testing-library/react";
import SkillPortfolioCard from "./SkillPortfolioCard";
import type { AssessorOverride, PortfolioSkill } from "@/types";

function skill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return {
    id: 1,
    skill_label: "React / Frontend Development Core",
    is_discovered: false,
    ai_level: 3,
    ai_confidence: "medium",
    evidence: ['"I split the context into a read-only and a write provider."'],
    competency_summary: "Handles complex state architecture with clear trade-off reasoning.",
    ...overrides,
  } as PortfolioSkill;
}

function override(overrides: Partial<AssessorOverride> = {}): AssessorOverride {
  return {
    id: 1,
    portfolio_skill_id: 1,
    ai_level: 4,
    override_level: 3,
    assessor_notes: "Evidence is team-level, not org-level.",
    ...overrides,
  } as AssessorOverride;
}

const noop = () => {};

describe("<SkillPortfolioCard />", () => {
  it("shows the level and the confidence together", () => {
    render(<SkillPortfolioCard skill={skill()} onOverrideSaved={noop} />);

    expect(screen.getByTestId("card-level")).toHaveTextContent("L3");
    expect(screen.getByText("Medium confidence")).toBeInTheDocument();
  });

  // The absence of quotes under a level is the most important thing on the
  // card. The old card hid the evidence block entirely when the array was
  // empty, so a rating and a confident summary sat above a blank gap.
  describe("when nothing supports the level", () => {
    it("says so instead of leaving a gap", () => {
      render(<SkillPortfolioCard skill={skill({ evidence: [] })} onOverrideSaved={noop} />);

      expect(screen.getByText(/no supporting quotes were captured/i)).toBeInTheDocument();
      expect(screen.getByText(/treat it as\s+unassessed/i)).toBeInTheDocument();
    });

    it("survives evidence being absent altogether", () => {
      render(<SkillPortfolioCard skill={skill({ evidence: undefined as never })} onOverrideSaved={noop} />);

      expect(screen.getByText(/no supporting quotes were captured/i)).toBeInTheDocument();
    });
  });

  describe("when the model is not confident", () => {
    it("tells the reader what not to do with the level", () => {
      render(<SkillPortfolioCard skill={skill({ ai_confidence: "low" })} onOverrideSaved={noop} />);

      expect(screen.getByText(/do not use this level to screen anyone out/i)).toBeInTheDocument();
    });

    it("treats a missing confidence as low rather than assuming the best", () => {
      render(<SkillPortfolioCard skill={skill({ ai_confidence: undefined as never })} onOverrideSaved={noop} />);

      expect(screen.getByText("Low confidence")).toBeInTheDocument();
    });
  });

  // An assessor who reviewed the evidence and set a level has made a human
  // judgement. It does not inherit the model's uncertainty, and the reader
  // should be able to see that a person intervened.
  describe("when an assessor has overridden the model", () => {
    it("shows the corrected level, not the model's", () => {
      render(<SkillPortfolioCard skill={skill({ ai_level: 4 })} override={override()} onOverrideSaved={noop} />);

      // Scoped to the badge: the override panel also prints both levels, and
      // the question here is which one the card leads with.
      expect(screen.getByTestId("card-level")).toHaveTextContent("L3");
      expect(screen.getByText(/AI rated L4; assessor set L3/)).toBeInTheDocument();
    });

    it("marks the card as carrying a human decision", () => {
      render(<SkillPortfolioCard skill={skill()} override={override()} onOverrideSaved={noop} />);

      expect(screen.getByText(/assessor override/i)).toBeInTheDocument();
    });

    it("drops the provisional caveat", () => {
      render(
        <SkillPortfolioCard
          skill={skill({ ai_confidence: "low" })}
          override={override()}
          onOverrideSaved={noop}
        />
      );

      expect(screen.queryByText(/do not use this level to screen anyone out/i)).not.toBeInTheDocument();
    });
  });

  // The backend used to turn a missing level into L1 through nil.to_i.clamp.
  // The card must not reintroduce the same fabrication on the way out.
  describe("when the interview never reached the skill", () => {
    it("shows no level rather than an invented one", () => {
      render(<SkillPortfolioCard skill={skill({ ai_level: null as never })} onOverrideSaved={noop} />);

      const badge = screen.getByTestId("card-level");
      expect(badge).toHaveTextContent(/not assessed/i);
      expect(badge).not.toHaveTextContent("L1");
    });

    it("says it is a gap in the interview, not a weakness in the candidate", () => {
      render(<SkillPortfolioCard skill={skill({ ai_level: null as never })} onOverrideSaved={noop} />);

      expect(screen.getByText(/gap in the interview/i)).toBeInTheDocument();
    });

    it("still shows the assessor's level once a human has set one", () => {
      render(
        <SkillPortfolioCard
          skill={skill({ ai_level: null as never })}
          override={override({ override_level: 2 })}
          onOverrideSaved={noop}
        />
      );

      expect(screen.getByTestId("card-level")).toHaveTextContent("L2");
    });
  });

  it("flags a skill the candidate raised unprompted", () => {
    render(<SkillPortfolioCard skill={skill({ is_discovered: true })} onOverrideSaved={noop} />);

    expect(screen.getByText("Discovered")).toBeInTheDocument();
  });

  it("renders a very long summary without dropping it", () => {
    const long = "The candidate reliably does this. ".repeat(60);
    render(<SkillPortfolioCard skill={skill({ competency_summary: long })} onOverrideSaved={noop} />);

    expect(screen.getByText(long.trim())).toBeInTheDocument();
  });
});
