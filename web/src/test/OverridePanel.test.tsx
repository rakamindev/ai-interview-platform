import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OverridePanel from "../components/portfolio/OverridePanel";
import { portfoliosApi } from "@/services/portfolios";
import type { PortfolioSkill, AssessorOverride } from "@/types";

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    getOverride: vi.fn(),
  },
}));

describe("OverridePanel Popover", () => {
  const mockSkill: PortfolioSkill = {
    id: 42,
    skill_label: "System Design & Scalability",
    is_discovered: false,
    ai_level: "L3",
    ai_confidence: "high",
    evidence: ["Explained CQRS and event sourcing"],
    competency_summary: "Solid distributed systems experience",
  };

  it("renders trigger button and opens popover on click", async () => {
    const user = userEvent.setup();
    render(<OverridePanel skill={mockSkill} onSaved={vi.fn()} />);

    const triggerBtn = screen.getByRole("button", { name: /Override rating/i });
    expect(triggerBtn).toBeInTheDocument();

    // Popover content should not be visible before clicking
    expect(screen.queryByText("Your rating:")).not.toBeInTheDocument();

    // Click trigger to open popover
    await user.click(triggerBtn);

    // Popover content should now be visible
    expect(screen.getByText("Your rating:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save override/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
  });

  it("renders existing override info and opens popover on Edit click", async () => {
    const user = userEvent.setup();
    const existingOverride: AssessorOverride = {
      id: 99,
      portfolio_skill_id: 42,
      ai_level: 3,
      override_level: 4,
      assessor_notes: "Strong staff performance in interview",
    };

    render(
      <OverridePanel
        skill={mockSkill}
        existingOverride={existingOverride}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByText(/You Overridden ✓/i)).toBeInTheDocument();
    const editBtn = screen.getByRole("button", { name: /Edit override/i });
    expect(editBtn).toBeInTheDocument();

    await user.click(editBtn);

    expect(screen.getByText("Your rating:")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Strong staff performance in interview")).toBeInTheDocument();
  });

  it("saves override successfully and closes popover", async () => {
    const user = userEvent.setup();
    const onSavedMock = vi.fn();
    const updatedOverride: AssessorOverride = {
      id: 101,
      portfolio_skill_id: 42,
      ai_level: 3,
      override_level: 5,
      assessor_notes: "Exemplary domain knowledge",
    };

    vi.mocked(portfoliosApi.getOverride).mockResolvedValueOnce({
      data: { override: updatedOverride },
    } as any);

    render(
      <OverridePanel
        skill={mockSkill}
        onSaved={onSavedMock}
      />
    );

    await user.click(screen.getByRole("button", { name: /Override rating/i }));

    // Level 5 button inside LevelRadio
    const level5Button = screen.getByRole("button", { name: /5/i });
    await user.click(level5Button);

    const notesInput = screen.getByPlaceholderText(/Add context for your override/i);
    await user.type(notesInput, "Exemplary domain knowledge");

    const saveButton = screen.getByRole("button", { name: /Save override/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(portfoliosApi.getOverride).toHaveBeenCalledWith(42, {
        override_level: 5,
        assessor_notes: "Exemplary domain knowledge",
      });
      expect(onSavedMock).toHaveBeenCalledWith(updatedOverride);
    });
  });
});
