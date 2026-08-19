import { describe, it, expect, vi } from "vite-plus/test";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";
import SkillPortfolioCard from "./SkillPortfolioCard";
import type { PortfolioSkill, AssessorOverride, TranscriptTurn } from "@/types";

const skill: PortfolioSkill = {
  id: 3,
  skill_label: "React",
  is_discovered: true,
  ai_level: "L3",
  ai_confidence: "medium",
  evidence: ["I built the dashboard with React"],
  competency_summary: "Comfortable with hooks and state management.",
};

const turns: TranscriptTurn[] = [
  {
    id: 1,
    created_at: "2025-01-01T00:00:00Z",
    turn_number: 2,
    speaker: "candidate",
    text: "I built the dashboard with React last quarter.",
  },
];

const override: AssessorOverride = {
  id: 9,
  portfolio_skill_id: 3,
  ai_level: 3,
  override_level: 4,
  assessor_notes: "",
};

describe("SkillPortfolioCard", () => {
  it("renders the skill header and confidence", () => {
    renderWithProviders(
      <SkillPortfolioCard
        skill={skill}
        assessmentId="1"
        sessionId="2"
        turns={turns}
        onOverrideSaved={vi.fn()}
      />,
    );
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Confidence: MEDIUM")).toBeInTheDocument();
    expect(screen.getByText("Discovered")).toBeInTheDocument();
    expect(screen.getByText("AI draft")).toBeInTheDocument();
  });

  it("links evidence quotes back to the matching transcript turn", () => {
    renderWithProviders(
      <SkillPortfolioCard
        skill={skill}
        assessmentId="11"
        sessionId="22"
        turns={turns}
        onOverrideSaved={vi.fn()}
      />,
    );
    const link = screen.getByRole("link", { name: /I built the dashboard with React/ });
    expect(link).toHaveAttribute("href", "/assessments/11/sessions/22/transcript?turn=2");
  });

  it("renders unmatched evidence as plain text", () => {
    const noMatch = { ...skill, evidence: ["something else entirely"] };
    renderWithProviders(
      <SkillPortfolioCard
        skill={noMatch}
        assessmentId="1"
        sessionId="2"
        turns={turns}
        onOverrideSaved={vi.fn()}
      />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/something else entirely/)).toBeInTheDocument();
  });

  it("shows the competency summary and the low-confidence note", () => {
    const lowConfidence = { ...skill, ai_confidence: "low" };
    renderWithProviders(
      <SkillPortfolioCard
        skill={lowConfidence}
        assessmentId="1"
        sessionId="2"
        turns={turns}
        onOverrideSaved={vi.fn()}
      />,
    );
    expect(screen.getByText(/Comfortable with hooks/)).toBeInTheDocument();
    expect(screen.getByText(/Only briefly explored/)).toBeInTheDocument();
  });

  it("marks overridden skills with the assessor verdict", () => {
    renderWithProviders(
      <SkillPortfolioCard
        skill={skill}
        override={override}
        assessmentId="1"
        sessionId="2"
        turns={turns}
        onOverrideSaved={vi.fn()}
      />,
    );
    expect(screen.getByText("Your verdict")).toBeInTheDocument();
    expect(screen.getByText("AI draft:")).toBeInTheDocument();
  });
});
