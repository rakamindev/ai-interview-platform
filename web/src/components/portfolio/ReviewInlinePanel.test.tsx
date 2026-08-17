import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewInlinePanel } from "@/components/portfolio/ReviewInlinePanel";
import { portfoliosApi } from "@/services/portfolios";
import type { PortfolioSkill } from "@/types";

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    reviewSkill: vi.fn(),
  },
}));

const baseSkill: PortfolioSkill = {
  id: 1,
  skill_label: "React / Frontend Development Core",
  is_discovered: false,
  ai_level: "L3",
  ai_confidence: "medium",
  evidence: ["quote"],
  evidence_provenance: [{ quote_index: 0, transcript_turn_id: 10, turn_number: 4, verified: true }],
  competency_summary: "summary",
  requires_review: false,
};

describe("ReviewInlinePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (portfoliosApi.reviewSkill as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { review: { id: 1 } },
    });
  });

  it("renders the three review actions", () => {
    render(<ReviewInlinePanel skill={baseSkill} onSaved={() => {}} />);
    expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /adjust/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /insufficient/i })).toBeInTheDocument();
  });

  it("sends a confirmed review without a rationale requirement", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<ReviewInlinePanel skill={baseSkill} onSaved={onSaved} />);

    await user.click(screen.getByRole("button", { name: /confirm/i }));
    await user.click(screen.getByRole("button", { name: /save review/i }));

    await waitFor(() => {
      expect(portfoliosApi.reviewSkill).toHaveBeenCalledWith(1, {
        outcome: "confirmed",
        reviewed_level: null,
        rationale: undefined,
      });
    });
    expect(onSaved).toHaveBeenCalledWith(1);
  });

  it("requires a rationale for adjusted and blocks save without it", async () => {
    const user = userEvent.setup();
    render(<ReviewInlinePanel skill={baseSkill} onSaved={() => {}} />);

    await user.click(screen.getByRole("button", { name: /adjust/i }));
    await user.click(screen.getByRole("button", { name: /save review/i }));

    expect(await screen.findByText(/rationale is required/i)).toBeInTheDocument();
    expect(portfoliosApi.reviewSkill).not.toHaveBeenCalled();
  });

  it("sends adjusted with a reviewed level and rationale", async () => {
    const user = userEvent.setup();
    render(<ReviewInlinePanel skill={baseSkill} onSaved={() => {}} />);

    await user.click(screen.getByRole("button", { name: /adjust/i }));
    const textarea = screen.getByLabelText(/rationale/i);
    await user.type(textarea, "Stronger evidence than AI judged");
    await user.click(screen.getByRole("button", { name: /save review/i }));

    await waitFor(() => {
      expect(portfoliosApi.reviewSkill).toHaveBeenCalledWith(1, {
        outcome: "adjusted",
        reviewed_level: 3,
        rationale: "Stronger evidence than AI judged",
      });
    });
  });

  it("sends insufficient_evidence with rationale and null level", async () => {
    const user = userEvent.setup();
    render(<ReviewInlinePanel skill={baseSkill} onSaved={() => {}} />);

    await user.click(screen.getByRole("button", { name: /insufficient/i }));
    const textarea = screen.getByLabelText(/rationale/i);
    await user.type(textarea, "No signal before cut off");
    await user.click(screen.getByRole("button", { name: /save review/i }));

    await waitFor(() => {
      expect(portfoliosApi.reviewSkill).toHaveBeenCalledWith(1, {
        outcome: "insufficient_evidence",
        reviewed_level: null,
        rationale: "No signal before cut off",
      });
    });
  });

  it("shows an error message when the save fails", async () => {
    const user = userEvent.setup();
    (portfoliosApi.reviewSkill as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));
    render(<ReviewInlinePanel skill={baseSkill} onSaved={() => {}} />);

    await user.click(screen.getByRole("button", { name: /confirm/i }));
    await user.click(screen.getByRole("button", { name: /save review/i }));

    expect(await screen.findByText(/failed to save review/i)).toBeInTheDocument();
  });
});
