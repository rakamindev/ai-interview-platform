import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OverridePanel from "@/components/portfolio/OverridePanel";
import { portfoliosApi } from "@/services/portfolios";
import type { AssessorOverride, PortfolioSkill } from "@/types";

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: { getOverride: vi.fn() },
}));

const skill: PortfolioSkill = {
  id: 1,
  skill_label: "Communication",
  is_discovered: false,
  ai_level: "L3",
  ai_confidence: "high",
  evidence: [],
  competency_summary: "",
};

const existingOverride: AssessorOverride = {
  id: 10,
  portfolio_skill_id: 1,
  ai_level: 3,
  override_level: 4,
  assessor_notes: "Looked strong in the interview.",
};

describe("OverridePanel", () => {
  beforeEach(() => {
    vi.mocked(portfoliosApi.getOverride).mockReset();
  });

  it("shows an 'Override rating' button by default when there is no existing override", () => {
    render(<OverridePanel skill={skill} onSaved={vi.fn()} />);

    expect(screen.getByRole("button", { name: /override rating/i })).toBeInTheDocument();
  });

  it("shows the AI level and the assessor's overridden level when an override already exists", () => {
    render(<OverridePanel skill={skill} existingOverride={existingOverride} onSaved={vi.fn()} />);

    expect(screen.getByText(/you overridden/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit override/i })).toBeInTheDocument();
  });

  it("opens the edit form when 'Override rating' is clicked", async () => {
    const user = userEvent.setup();
    render(<OverridePanel skill={skill} onSaved={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /override rating/i }));

    expect(screen.getByText("Override")).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save override/i })).toBeInTheDocument();
  });

  it("saves the override and calls onSaved with the returned override", async () => {
    const onSaved = vi.fn();
    const savedOverride = { ...existingOverride, override_level: 4 };
    vi.mocked(portfoliosApi.getOverride).mockResolvedValueOnce({
      data: { override: savedOverride },
    } as never);
    const user = userEvent.setup();

    render(<OverridePanel skill={skill} onSaved={onSaved} />);

    await user.click(screen.getByRole("button", { name: /override rating/i }));
    await user.click(screen.getByRole("button", { name: /save override/i }));

    await waitFor(() => expect(portfoliosApi.getOverride).toHaveBeenCalledWith(skill.id, {
      override_level: 3,
      assessor_notes: "",
    }));
    expect(onSaved).toHaveBeenCalledWith(savedOverride);
    // Closes the edit form again after a successful save.
    expect(screen.queryByRole("button", { name: /save override/i })).not.toBeInTheDocument();
  });

  it("shows an inline error and keeps the form open when saving fails", async () => {
    vi.mocked(portfoliosApi.getOverride).mockRejectedValueOnce(new Error("network error"));
    const user = userEvent.setup();

    render(<OverridePanel skill={skill} onSaved={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /override rating/i }));
    await user.click(screen.getByRole("button", { name: /save override/i }));

    expect(await screen.findByText(/failed to save override/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save override/i })).toBeInTheDocument();
  });
});
