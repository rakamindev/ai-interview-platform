import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import OverridePanel from "./OverridePanel";
import { portfoliosApi } from "@/services/portfolios";
import type { PortfolioSkill } from "@/types";

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    getOverride: vi.fn(),
  },
}));

describe("OverridePanel", () => {
  const skill: PortfolioSkill = {
    id: 1,
    skill_label: "Ruby / Backend",
    is_discovered: false,
    ai_level: 2,
    ai_confidence: "high",
    evidence: [],
    competency_summary: "Summary",
  };

  it("exposes accessible radiogroup associated with Your rating label and retains names for all radios", async () => {
    const user = userEvent.setup();
    render(<OverridePanel skill={skill} onSaved={vi.fn()} />);

    const overrideBtn = screen.getByRole("button", { name: /Override rating/i });
    await user.click(overrideBtn);

    const radioGroup = screen.getByRole("radiogroup", { name: /your rating/i });
    expect(radioGroup).toBeInTheDocument();

    ["L1", "L2", "L3", "L4", "L5"].forEach((levelLabel) => {
      expect(screen.getByRole("radio", { name: levelLabel })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save override" })).toBeInTheDocument();
  });

  it("allows selecting numeric rating and saves override using genuine keyboard-only navigation (userEvent)", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    vi.mocked(portfoliosApi.getOverride).mockResolvedValueOnce({
      data: {
        override: {
          id: 101,
          portfolio_skill_id: 1,
          ai_level: 2,
          override_level: 3,
          assessor_notes: "Strong candidate",
        },
      },
    } as any);

    render(<OverridePanel skill={skill} onSaved={onSaved} />);

    // 1. Focus open button and press Enter
    const overrideBtn = screen.getByRole("button", { name: /Override rating/i });
    overrideBtn.focus();
    expect(overrideBtn).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("radiogroup", { name: /your rating/i })).toBeInTheDocument();

    // 2. Focus L3 radio button and select with Space key
    const l3Radio = screen.getByRole("radio", { name: "L3" });
    l3Radio.focus();
    expect(l3Radio).toHaveFocus();
    await user.keyboard(" ");

    // 3. Tab into notes textarea and type via keyboard
    await user.tab();
    const notesInput = screen.getByPlaceholderText(/Add context for your override/i);
    expect(notesInput).toHaveFocus();
    await user.keyboard("Strong candidate");

    // 4. Tab to Cancel, then to Save override button
    await user.tab();
    await user.tab();

    const saveBtn = screen.getByRole("button", { name: "Save override" });
    expect(saveBtn).toHaveFocus();

    // 5. Activate save with Enter key
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(portfoliosApi.getOverride).toHaveBeenCalledWith(1, {
        override_level: 3,
        assessor_notes: "Strong candidate",
      });
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it("supports cancelling override panel with keyboard Enter", async () => {
    const user = userEvent.setup();
    render(<OverridePanel skill={skill} onSaved={vi.fn()} />);

    const openBtn = screen.getByRole("button", { name: /Override rating/i });
    openBtn.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("Your rating:")).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    cancelBtn.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("button", { name: /Override rating/i })).toBeInTheDocument();
  });

  it("displays error message when saving fails", async () => {
    const user = userEvent.setup();
    vi.mocked(portfoliosApi.getOverride).mockRejectedValueOnce(new Error("Network Error"));

    render(<OverridePanel skill={skill} onSaved={vi.fn()} />);

    const openBtn = screen.getByRole("button", { name: /Override rating/i });
    openBtn.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("Your rating:")).toBeInTheDocument();

    const saveBtn = screen.getByRole("button", { name: "Save override" });
    saveBtn.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText(/Failed to save override/i)).toBeInTheDocument();
    });
  });
});
