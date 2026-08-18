import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import OverridePanel from "./OverridePanel";
import type { PortfolioSkill, AssessorOverride } from "@/types";

// Mock the API service
vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    getOverride: vi.fn(),
    getOverrideHistory: vi.fn().mockResolvedValue({ data: { override_events: [] } }),
  },
}));

function makeSkill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return {
    id: 1,
    skill_id: "react",
    skill_label: "React",
    is_discovered: false,
    ai_level: 3,
    ai_confidence: "high",
    evidence: [],
    competency_summary: "",
    ...overrides,
  };
}

function makeOverride(overrides: Partial<AssessorOverride> = {}): AssessorOverride {
  return {
    id: 10,
    portfolio_skill_id: 1,
    ai_level: 3,
    override_level: 4,
    assessor_notes: "Demonstrated advanced patterns in interview",
    overridden_by: 1,
    overridden_at: "2025-01-15T10:30:00Z",
    ...overrides,
  };
}

describe("OverridePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC-3.2 — Reason is required
  it("disables save button when notes are empty", () => {
    render(<OverridePanel skill={makeSkill()} onSaved={vi.fn()} />);

    // Open the dialog
    fireEvent.click(screen.getByRole("button", { name: /override rating/i }));

    // Save should be disabled when notes are empty
    const saveBtn = screen.getByRole("button", { name: /save override/i });
    expect(saveBtn).toBeDisabled();
  });

  it("enables save button when notes are entered", () => {
    render(<OverridePanel skill={makeSkill()} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /override rating/i }));

    const textarea = screen.getByPlaceholderText(/explain why/i);
    fireEvent.change(textarea, { target: { value: "Good coverage of core concepts" } });

    const saveBtn = screen.getByRole("button", { name: /save override/i });
    expect(saveBtn).toBeEnabled();
  });

  // Label shows "Reason *" not "Notes (optional)"
  it("labels the notes field as required", () => {
    render(<OverridePanel skill={makeSkill()} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /override rating/i }));

    // Use getByLabelText to target the label specifically
    expect(screen.getByLabelText(/reason/i)).toBeInTheDocument();
    expect(screen.queryByText(/optional/i)).not.toBeInTheDocument();
  });

  // No text glyphs — lucide icons used
  it("does not render text glyphs for override actions", () => {
    render(<OverridePanel skill={makeSkill()} onSaved={vi.fn()} />);
    expect(screen.queryByText("▼")).not.toBeInTheDocument();
    expect(screen.queryByText("✓")).not.toBeInTheDocument();
  });

  // Shows correct button for no existing override
  it("renders override button when no existing override", () => {
    render(<OverridePanel skill={makeSkill()} onSaved={vi.fn()} />);
    expect(screen.getByRole("button", { name: /override rating/i })).toBeInTheDocument();
  });

  // Shows correct button for existing override
  it("renders edit button when override exists", () => {
    render(
      <OverridePanel
        skill={makeSkill()}
        existingOverride={makeOverride()}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /override applied/i })).toBeInTheDocument();
  });

  // Dialog does not shove layout (it's a dialog, not inline)
  it("renders a dialog when opened, not inline content", () => {
    render(<OverridePanel skill={makeSkill()} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /override rating/i }));

    // Dialog should have role="dialog"
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
