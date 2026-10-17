import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import type { PortfolioSkill, AssessorOverride } from "@/types";

describe("SkillPortfolioCard component", () => {
  const sampleSkill: PortfolioSkill = {
    id: 101,
    skill_label: "State Management & React Hooks",
    is_discovered: false,
    ai_level: "L3",
    ai_confidence: "high",
    evidence: [
      "Demonstrated complex state machines using XState and useReducer.",
      "Discussed trade-offs between local state and global Zustand store.",
      "Identified memory leak scenarios in custom useEffect listeners.",
    ],
    competency_summary:
      "Candidate demonstrates solid understanding of state management architectures.",
  };

  const mockSaveOverride = vi.fn();

  it("renders skill title, AI level, and initial evidence quotes", () => {
    render(
      <SkillPortfolioCard
        skill={sampleSkill}
        onOverrideSaved={mockSaveOverride}
      />
    );

    expect(screen.getByText("State Management & React Hooks")).toBeInTheDocument();
    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText("Confidence: HIGH")).toBeInTheDocument();
    expect(screen.getByText(/Demonstrated complex state machines/)).toBeInTheDocument();
    expect(screen.getByText(/Discussed trade-offs between local state/)).toBeInTheDocument();
  });

  it("toggles evidence quotes when clicking Show all / Show less", async () => {
    render(
      <SkillPortfolioCard
        skill={sampleSkill}
        onOverrideSaved={mockSaveOverride}
      />
    );

    const toggleButton = screen.getByRole("button", { name: /Show all/i });
    expect(toggleButton).toBeInTheDocument();

    // 3rd quote should initially not be visible since default slices to 2
    expect(screen.queryByText(/Identified memory leak scenarios/)).not.toBeInTheDocument();

    // Click show all
    fireEvent.click(toggleButton);
    expect(screen.getByText(/Identified memory leak scenarios/)).toBeInTheDocument();

    // Click show less
    const collapseButton = screen.getByRole("button", { name: /Show less/i });
    fireEvent.click(collapseButton);
    await waitFor(() => {
      expect(screen.queryByText(/Identified memory leak scenarios/)).not.toBeInTheDocument();
    });
  });

  it("displays assessor override badge and rationale when override is present", () => {
    const sampleOverride: AssessorOverride = {
      id: 55,
      portfolio_skill_id: 101,
      ai_level: 3,
      override_level: 4,
      assessor_notes: "Demonstrated org-wide library standard setting during technical discussion.",
    };

    render(
      <SkillPortfolioCard
        skill={sampleSkill}
        override={sampleOverride}
        onOverrideSaved={mockSaveOverride}
      />
    );

    expect(screen.getAllByText("L4")[0]).toBeInTheDocument();
    expect(screen.getByText(/Overridden: L4/)).toBeInTheDocument();
    expect(
      screen.getByText(/Demonstrated org-wide library standard setting/)
    ).toBeInTheDocument();
  });

  it("displays low confidence advisory when ai_confidence is low", () => {
    const lowConfidenceSkill: PortfolioSkill = {
      ...sampleSkill,
      ai_confidence: "low",
    };

    render(
      <SkillPortfolioCard
        skill={lowConfidenceSkill}
        onOverrideSaved={mockSaveOverride}
      />
    );

    expect(
      screen.getByText(/Tingkat keyakinan AI rendah|Only briefly explored/i)
    ).toBeInTheDocument();
  });
});
