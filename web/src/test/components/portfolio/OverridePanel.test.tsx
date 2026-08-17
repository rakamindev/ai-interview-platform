import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OverridePanel from "@/components/portfolio/OverridePanel";
import { portfoliosApi } from "@/services/portfolios";
import type { PortfolioSkill, AssessorOverride } from "@/types";

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    getOverride: vi.fn(),
  },
}));

const getOverrideMock = vi.mocked(portfoliosApi.getOverride);

function skill(overrides: Partial<PortfolioSkill> = {}): PortfolioSkill {
  return {
    id: 1,
    skill_label: "React",
    is_discovered: false,
    ai_level: 3,
    ai_confidence: "high",
    evidence: [],
    competency_summary: "",
    ...overrides,
  };
}

function override(overrides: Partial<AssessorOverride> = {}): AssessorOverride {
  return {
    id: 1,
    portfolio_skill_id: 1,
    ai_level: 3,
    override_level: 5,
    assessor_notes: "",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OverridePanel", () => {
  it("shows the closed 'Override rating' prompt when there is no existing override", () => {
    render(<OverridePanel skill={skill()} onSaved={vi.fn()} />);

    expect(screen.getByText("Override rating ▼")).toBeInTheDocument();
    expect(screen.queryByText(/You Overridden/)).not.toBeInTheDocument();
  });

  it("shows the AI level, override level, and overridden marker when an override exists", () => {
    render(<OverridePanel skill={skill({ ai_level: 2 })} existingOverride={override({ override_level: 5 })} onSaved={vi.fn()} />);

    expect(screen.getByText("L2")).toBeInTheDocument();
    expect(screen.getByText("L5")).toBeInTheDocument();
    expect(screen.getByText(/You Overridden/)).toBeInTheDocument();
  });

  it("opens the edit form when clicked", () => {
    render(<OverridePanel skill={skill()} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByText("Override rating ▼"));

    expect(screen.getByText("Override")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save override" })).toBeInTheDocument();
  });

  it("saves the override, calls onSaved, and closes the form on success", async () => {
    const savedOverride = override({ override_level: 4 });
    getOverrideMock.mockResolvedValue({ data: { override: savedOverride } } as any);
    const onSaved = vi.fn();

    render(<OverridePanel skill={skill()} onSaved={onSaved} />);
    fireEvent.click(screen.getByText("Override rating ▼"));
    fireEvent.click(screen.getByRole("button", { name: "Save override" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedOverride));
    expect(screen.queryByText("Save override")).not.toBeInTheDocument();
  });

  it("shows an inline error and keeps the form open when saving fails", async () => {
    getOverrideMock.mockRejectedValue(new Error("network down"));
    const onSaved = vi.fn();

    render(<OverridePanel skill={skill()} onSaved={onSaved} />);
    fireEvent.click(screen.getByText("Override rating ▼"));
    fireEvent.click(screen.getByRole("button", { name: "Save override" }));

    expect(await screen.findByText("Failed to save override. Please try again.")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save override" })).toBeInTheDocument();
  });

  it("closes the form without saving when Cancel is clicked", () => {
    render(<OverridePanel skill={skill()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByText("Override rating ▼"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Override rating ▼")).toBeInTheDocument();
    expect(getOverrideMock).not.toHaveBeenCalled();
  });
});
