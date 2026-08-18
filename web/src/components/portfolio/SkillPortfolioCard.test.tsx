import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SkillPortfolioCard from "./SkillPortfolioCard";
import type { PortfolioSkill } from "@/types";

vi.mock("./OverridePanel", () => ({
  default: () => <div data-testid="override-panel" />,
}));

const skill = (overrides: Partial<PortfolioSkill> = {}): PortfolioSkill => ({
  id: 1,
  skill_label: "RESTful API Design",
  is_discovered: false,
  assessed: true,
  ai_level: "2",
  ai_confidence: "high",
  evidence: ["I built the endpoints myself"],
  competency_summary: "Builds routine APIs independently.",
  ...overrides,
});

const unassessed = skill({
  assessed: false,
  ai_level: null,
  ai_confidence: null,
  competency_summary: null,
  evidence: [],
});

const noop = () => {};

describe("SkillPortfolioCard", () => {
  describe("a skill the interview never covered", () => {
    it("says so instead of showing a level", () => {
      render(<SkillPortfolioCard skill={unassessed} onOverrideSaved={noop} />);

      expect(screen.getByText(/not assessed/i)).toBeInTheDocument();
    });

    it("explains why there is no evidence", () => {
      render(<SkillPortfolioCard skill={unassessed} onOverrideSaved={noop} />);

      expect(
        screen.getByText(/did not cover this skill/i),
      ).toBeInTheDocument();
    });

    it("does not show a confidence grade for a rating that does not exist", () => {
      render(<SkillPortfolioCard skill={unassessed} onOverrideSaved={noop} />);

      expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
    });

    it("still names the skill, so the gap is visible rather than hidden", () => {
      render(<SkillPortfolioCard skill={unassessed} onOverrideSaved={noop} />);

      expect(screen.getByText("RESTful API Design")).toBeInTheDocument();
    });
  });

  describe("an assessed skill", () => {
    it("shows its evidence", () => {
      render(<SkillPortfolioCard skill={skill()} onOverrideSaved={noop} />);

      expect(screen.getByText(/I built the endpoints myself/)).toBeInTheDocument();
    });

    // These are speech-to-text. One portfolio had "label" where the candidate
    // said "Laravel", presented as a direct quote.
    it("marks the quotes as automatic transcription", () => {
      render(<SkillPortfolioCard skill={skill()} onOverrideSaved={noop} />);

      expect(screen.getByText(/automatic transcription/i)).toBeInTheDocument();
    });

    // Evidence quotes run past 300 characters. Unclamped they push everything
    // else below the fold.
    describe("a long quote", () => {
      const long = "a".repeat(400);

      it("is collapsed until asked for", () => {
        render(
          <SkillPortfolioCard skill={skill({ evidence: [long] })} onOverrideSaved={noop} />,
        );

        expect(screen.getByText(/^• "a+"$/)).toHaveClass("line-clamp-3");
      });

      it("expands on request", () => {
        render(
          <SkillPortfolioCard skill={skill({ evidence: [long] })} onOverrideSaved={noop} />,
        );

        fireEvent.click(screen.getByRole("button", { name: /show full quotes/i }));

        expect(screen.getByText(/^• "a+"$/)).not.toHaveClass("line-clamp-3");
      });

      it("offers no toggle when every quote is short", () => {
        render(<SkillPortfolioCard skill={skill()} onOverrideSaved={noop} />);

        expect(
          screen.queryByRole("button", { name: /show full quotes/i }),
        ).not.toBeInTheDocument();
      });
    });

    it("keeps the low-confidence caveat", () => {
      render(
        <SkillPortfolioCard skill={skill({ ai_confidence: "low" })} onOverrideSaved={noop} />,
      );

      expect(screen.getByText(/confidence is low/i)).toBeInTheDocument();
    });
  });
});
