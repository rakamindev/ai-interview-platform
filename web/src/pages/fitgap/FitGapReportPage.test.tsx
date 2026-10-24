import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import FitGapReportPage from "./FitGapReportPage";
import type { FitGapState } from "@/types";

const mocks = vi.hoisted(() => ({
  getPortfolio: vi.fn(),
  getFitGap: vi.fn(),
  triggerFitGap: vi.fn(),
  regenerateFitGap: vi.fn(),
  exportPortfolio: vi.fn(),
}));

vi.mock("@/services/sessions", () => ({ sessionsApi: { getPortfolio: mocks.getPortfolio } }));
vi.mock("@/services/portfolios", () => ({ portfoliosApi: {
  getFitGap: mocks.getFitGap,
  triggerFitGap: mocks.triggerFitGap,
  regenerateFitGap: mocks.regenerateFitGap,
  exportPortfolio: mocks.exportPortfolio,
} }));

const report: NonNullable<FitGapState["report"]> = {
  id: 9,
  portfolio_id: 1,
  vacancy_id: 2,
  generated_at: "2026-10-22T00:00:00Z",
  culture_narrative: null,
  overall_narrative: "Evidence is limited.",
  skill_comparisons: [{ skill_label: "React", required_level: 3, candidate_level: null,
    result: "not_assessed", delta: null, is_override: false, evidence_count: 1,
    reason: "Insufficient evidence" }],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/4/sessions/7/fitgap/2"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/fitgap/:vacancyId" element={<FitGapReportPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("FitGapReportPage", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPortfolio.mockResolvedValue({ data: { portfolio: { id: 1, generation_status: "complete", skills: [] } } });
  });

  it("shows a stale snapshot with export disabled while regeneration runs", async () => {
    mocks.getFitGap.mockResolvedValue({ data: { report, stale: true,
      generation: { status: "running", error_code: null, requested_at: "", updated_at: "" } } });

    renderPage();

    expect(await screen.findByText(/last completed report/i)).toBeTruthy();
    expect(screen.getByText(/previous report remains visible below/i)).toBeTruthy();
    expect(screen.getByText(/Report generated:/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "PDF" })).toBeNull();
    expect(mocks.triggerFitGap).not.toHaveBeenCalled();
  });

  it("starts one generation for an empty state and displays a failure for explicit retry", async () => {
    mocks.getFitGap.mockResolvedValue({ data: { report: null, stale: false, generation: null } });
    mocks.triggerFitGap.mockResolvedValue({ data: { report: null, stale: false,
      generation: { status: "failed", error_code: "SyntheticFailure", requested_at: "", updated_at: "" } } });

    renderPage();

    expect(await screen.findByText(/Generation failed \(SyntheticFailure\)/)).toBeTruthy();
    await waitFor(() => expect(mocks.triggerFitGap).toHaveBeenCalledTimes(1));
    mocks.regenerateFitGap.mockResolvedValue({ data: { report: null, stale: false,
      generation: { status: "queued", error_code: null, requested_at: "", updated_at: "" } } });
    fireEvent.click(screen.getByRole("button", { name: /Regenerate/i }));
    await waitFor(() => expect(mocks.regenerateFitGap).toHaveBeenCalledTimes(1));
  });

  it("reloads the portfolio when the initial load failed and Try again is selected", async () => {
    mocks.getPortfolio.mockRejectedValueOnce(new Error("Synthetic network failure"));
    mocks.getFitGap.mockResolvedValue({ data: { report, stale: false, generation: null } });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));

    await waitFor(() => expect(mocks.getPortfolio).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Report generated:/i)).toBeTruthy();
  });
});
