import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SkillPortfolioCard from "./SkillPortfolioCard";
import type { AssessorOverride, PortfolioSkill } from "@/types";

vi.mock("@/services/portfolios", () => ({ portfoliosApi: { saveOverride: vi.fn() } }));

function skill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return {
    id: 1,
    skill_id: "SK-ENG-001",
    skill_label: "React / Frontend Development Core",
    is_discovered: false,
    ai_level: 3,
    ai_confidence: "high",
    assessment_status: "assessed",
    status_reason: null,
    evidence: ["I profile before I memoize."],
    competency_summary: "Consistent L3 behaviour.",
    ...overrides,
  };
}

const notAssessed = skill({
  skill_label: "Communication",
  assessment_status: "not_assessed",
  ai_level: null,
  ai_confidence: null,
  status_reason: "Not discussed in the interview.",
  evidence: [],
  competency_summary: "",
});

function renderCard(s: PortfolioSkill, override?: AssessorOverride) {
  return render(<SkillPortfolioCard skill={s} override={override} onOverrideSaved={vi.fn()} />);
}

describe("SkillPortfolioCard", () => {
  it("shows the level and confidence of an assessed skill", () => {
    renderCard(skill());

    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText("Confidence: HIGH")).toBeInTheDocument();
    expect(screen.getByText("“I profile before I memoize.”")).toBeInTheDocument();
  });

  it("shows a skill the interview never reached as not assessed, never as L1 (AC1.5)", () => {
    renderCard(notAssessed);

    expect(screen.getByText("Not assessed")).toBeInTheDocument();
    expect(screen.getByText("Not discussed in the interview.")).toBeInTheDocument();
    expect(screen.queryByText("L1")).not.toBeInTheDocument();
    expect(screen.queryByText(/Confidence:/)).not.toBeInTheDocument();
  });

  it("flags model output that needs review, with the reason, and keeps its evidence", () => {
    renderCard(
      skill({ assessment_status: "needs_review", ai_level: null, ai_confidence: "medium",
              status_reason: "The AI returned no rating for this skill." })
    );

    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("The AI returned no rating for this skill.")).toBeInTheDocument();
    expect(screen.getByText("“I profile before I memoize.”")).toBeInTheDocument();
  });

  it("caveats a low-confidence rating", () => {
    renderCard(skill({ ai_level: 2, ai_confidence: "low" }));

    expect(screen.getByText("Briefly explored. Treat this rating as provisional.")).toBeInTheDocument();
  });

  it("says when there is no summary", () => {
    renderCard(skill({ competency_summary: "" }));

    expect(screen.getByText("No summary provided.")).toBeInTheDocument();
  });

  it("shows an override with the AI's rating, the note and when it was made (AC6.5)", () => {
    renderCard(notAssessed, {
      id: 9, portfolio_skill_id: 1, ai_level: null, override_level: 2,
      assessor_notes: "Explained trade-offs clearly in the follow-up.", overridden_at: "2026-10-26T07:05:00Z",
    });

    expect(screen.getByText("L2")).toBeInTheDocument();
    expect(screen.getByText(/Set by assessor/)).toBeInTheDocument();
    expect(screen.getByText(/AI had not rated this skill/)).toBeInTheDocument();
    expect(screen.getByText(/26 Oct 2026/)).toBeInTheDocument();
    expect(screen.getByText("“Explained trade-offs clearly in the follow-up.”")).toBeInTheDocument();
  });

  it("opens the override form below the card content, not in the header", async () => {
    renderCard(skill());

    await userEvent.click(screen.getByRole("button", { name: "Override rating" }));

    expect(screen.getByRole("radiogroup", { name: "Your rating" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Override rating" })).not.toBeInTheDocument();
  });
});
