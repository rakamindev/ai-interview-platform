import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";
import OverridePanel from "./OverridePanel";
import type { PortfolioSkill, AssessorOverride } from "@/types";

const getOverrideMock = vi.hoisted(() => vi.fn());

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: { getOverride: getOverrideMock },
}));

const skill: PortfolioSkill = {
  id: 7,
  skill_label: "React",
  is_discovered: false,
  ai_level: "L3",
  ai_confidence: "high",
  evidence: [],
  competency_summary: "",
};

const savedOverride: AssessorOverride = {
  id: 1,
  portfolio_skill_id: 7,
  ai_level: 3,
  override_level: 4,
  assessor_notes: "Strong debugging session",
};

describe("OverridePanel", () => {
  beforeEach(() => {
    getOverrideMock.mockReset();
  });
  it("offers to create an override when none exists", () => {
    renderWithProviders(<OverridePanel skill={skill} onSaved={vi.fn()} />);
    expect(screen.getByText("Override rating ▼")).toBeInTheDocument();
  });

  it("shows the existing override summary and an edit action", () => {
    renderWithProviders(
      <OverridePanel skill={skill} existingOverride={savedOverride} onSaved={vi.fn()} />,
    );
    expect(screen.getByText("You Overridden ✓")).toBeInTheDocument();
    expect(screen.getByText("Edit override")).toBeInTheDocument();
  });

  it("saves an override and reports it via onSaved", async () => {
    getOverrideMock.mockResolvedValue({ data: { override: savedOverride } });
    const onSaved = vi.fn();
    renderWithProviders(<OverridePanel skill={skill} onSaved={onSaved} />);

    fireEvent.click(screen.getByText("Override rating ▼"));
    expect(screen.getByText("Your rating:")).toBeInTheDocument();

    const notes = screen.getByPlaceholderText("Add context for your override...");
    fireEvent.change(notes, { target: { value: "Solid fundamentals" } });
    fireEvent.click(screen.getByText("Save override"));

    await waitFor(() =>
      expect(getOverrideMock).toHaveBeenCalledWith(7, {
        override_level: 3,
        assessor_notes: "Solid fundamentals",
      }),
    );
    expect(onSaved).toHaveBeenCalledWith(savedOverride);
    await waitFor(() => expect(screen.getByText("Override rating ▼")).toBeInTheDocument());
  });

  it("pre-fills the form with the existing override values", () => {
    renderWithProviders(
      <OverridePanel skill={skill} existingOverride={savedOverride} onSaved={vi.fn()} />,
    );
    fireEvent.click(screen.getByText("Edit override"));
    expect(screen.getByPlaceholderText("Add context for your override...")).toHaveValue(
      "Strong debugging session",
    );
  });

  it("keeps the panel open and surfaces an error when saving fails", async () => {
    getOverrideMock.mockRejectedValue(new Error("boom"));
    renderWithProviders(<OverridePanel skill={skill} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByText("Override rating ▼"));
    fireEvent.click(screen.getByText("Save override"));

    await waitFor(() =>
      expect(screen.getByText("Failed to save override. Please try again.")).toBeInTheDocument(),
    );
    expect(screen.getByText("Save override")).toBeInTheDocument();
  });

  it("cancels back to the closed state without saving", () => {
    renderWithProviders(<OverridePanel skill={skill} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByText("Override rating ▼"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.getByText("Override rating ▼")).toBeInTheDocument();
    expect(getOverrideMock).not.toHaveBeenCalled();
  });
});
