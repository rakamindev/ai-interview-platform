import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DecisionPanel from "./DecisionPanel";
import type { PortfolioDecision } from "@/types";

const api = vi.hoisted(() => ({
  finalizeDecision: vi.fn(),
  reopenDecision: vi.fn(),
}));

vi.mock("@/services/sessions", () => ({
  sessionsApi: api,
}));

const aiFailDecision = (): PortfolioDecision => ({
  status: "ai_recommended",
  effective_outcome: "fail",
  source: "ai",
  ai_recommendation: {
    outcome: "fail",
    rationale: "The expected level was not consistently demonstrated in the transcript.",
    recommended_at: "2026-08-23T12:00:00Z",
  },
  finalization: null,
  history: [{ event_type: "ai_recommended", outcome: "fail", created_at: "2026-08-23T12:00:00Z" }],
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DecisionPanel", () => {
  it("requires a note before an admin can finalize against the AI recommendation", async () => {
    const onDecisionChanged = vi.fn();
    const finalizedDecision: PortfolioDecision = {
      ...aiFailDecision(),
      status: "finalized",
      effective_outcome: "pass",
      source: "admin",
      finalization: {
        outcome: "pass",
        note: "The transcript contains sufficient practical evidence.",
        finalized_by: 1,
        finalized_at: "2026-08-23T12:10:00Z",
      },
    };
    api.finalizeDecision.mockResolvedValue({ data: { decision: finalizedDecision } });

    render(<DecisionPanel sessionId={42} decision={aiFailDecision()} onDecisionChanged={onDecisionChanged} />);

    fireEvent.click(screen.getByRole("radio", { name: "Pass" }));
    expect(screen.getByText("Finalization note (required)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Finalize Pass" }));
    expect(screen.getByRole("alert")).toHaveTextContent("finalization note is required");

    fireEvent.change(screen.getByLabelText("Finalization note (required)"), {
      target: { value: "The transcript contains sufficient practical evidence." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Finalize Pass" }));

    await waitFor(() => {
      expect(api.finalizeDecision).toHaveBeenCalledWith(42, "pass", "The transcript contains sufficient practical evidence.");
      expect(onDecisionChanged).toHaveBeenCalledWith(finalizedDecision);
    });
  });

  it("requires a reason before reopening a finalized decision", () => {
    const finalizedDecision: PortfolioDecision = {
      ...aiFailDecision(),
      status: "finalized",
      effective_outcome: "fail",
      source: "admin",
      finalization: {
        outcome: "fail",
        finalized_by: 1,
        finalized_at: "2026-08-23T12:10:00Z",
      },
    };

    render(<DecisionPanel sessionId={42} decision={finalizedDecision} onDecisionChanged={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Reopen decision" }));
    fireEvent.click(screen.getByRole("button", { name: "Reopen for review" }));

    expect(screen.getByRole("alert")).toHaveTextContent("reopen reason is required");
    expect(api.reopenDecision).not.toHaveBeenCalled();
  });
});
