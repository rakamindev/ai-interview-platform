import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import OverridePanel from "@/components/portfolio/OverridePanel";
import { portfoliosApi } from "@/services/portfolios";
import type { PortfolioSkill } from "@/types";

describe("OverridePanel Error Handling", () => {
  const mockSkill: PortfolioSkill = {
    id: 1,
    skill_label: "Ruby",
    is_discovered: false,
    ai_level: 3,
    ai_confidence: "high",
    evidence: [],
    competency_summary: "Summary",
  };

  it("displays API error message and retry button when save fails", async () => {
    vi.spyOn(portfoliosApi, "saveOverride").mockRejectedValueOnce({
      response: { data: { errors: [{ message: "Validation error on override level" }] } },
    });

    render(<OverridePanel skill={mockSkill} onSaved={vi.fn()} />);

    // Open override panel
    fireEvent.click(screen.getByText(/Override rating/i));

    // Click save
    fireEvent.click(screen.getByText("Save override"));

    await waitFor(() => {
      expect(screen.getByText("Validation error on override level")).toBeInTheDocument();
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });
  });
});
