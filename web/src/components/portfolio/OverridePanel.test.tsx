import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OverridePanel from "./OverridePanel";
import type { PortfolioSkill } from "@/types";

vi.mock("@/services/portfolios", () => ({
  portfoliosApi: {
    getOverride: vi.fn(),
  },
}));

import { portfoliosApi } from "@/services/portfolios";

const skill: PortfolioSkill = {
  id: 7,
  skill_id: 7,
  skill_label: "RESTful API Design",
  is_discovered: false,
  ai_level: "L1",
  ai_confidence: "low",
  evidence: [],
  competency_summary: "",
};

describe("OverridePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the panel and saves a successful override via onSaved", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onStale = vi.fn();

    const override = {
      id: 5,
      portfolio_skill_id: 7,
      override_level: 3,
      assessor_notes: "notes",
    };
    (portfoliosApi.getOverride as any).mockResolvedValue({
      data: { override },
    });

    render(<OverridePanel skill={skill} onSaved={onSaved} onStale={onStale} />);

    await user.click(screen.getByRole("button", { name: /Override rating/i }));
    await user.click(screen.getByRole("button", { name: /Save override/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(override));
    expect(onStale).not.toHaveBeenCalled();
  });

  it("calls onStale (portfolio refetch) when the API answers 404 — stale skill id", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onStale = vi.fn();

    (portfoliosApi.getOverride as any).mockRejectedValue({
      response: { status: 404 },
    });

    render(<OverridePanel skill={skill} onSaved={onSaved} onStale={onStale} />);

    await user.click(screen.getByRole("button", { name: /Override rating/i }));
    await user.click(screen.getByRole("button", { name: /Save override/i }));

    await waitFor(() => expect(onStale).toHaveBeenCalledTimes(1));
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByText(/Failed to save override/i)).toBeInTheDocument();
  });

  it("shows a retryable error on a 5xx failure without calling onStale", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onStale = vi.fn();

    (portfoliosApi.getOverride as any).mockRejectedValue({
      response: { status: 500 },
    });

    render(<OverridePanel skill={skill} onSaved={onSaved} onStale={onStale} />);

    await user.click(screen.getByRole("button", { name: /Override rating/i }));
    await user.click(screen.getByRole("button", { name: /Save override/i }));

    await waitFor(() =>
      expect(screen.getByText(/Failed to save override/i)).toBeInTheDocument(),
    );
    expect(onStale).not.toHaveBeenCalled();
  });
});
