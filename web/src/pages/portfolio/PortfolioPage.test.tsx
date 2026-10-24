import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PortfolioPage from "./PortfolioPage";

const mocks = vi.hoisted(() => ({
  getPortfolio: vi.fn(),
  regeneratePortfolio: vi.fn(),
  getSession: vi.fn(),
  listVacancies: vi.fn(),
  exportPortfolio: vi.fn(),
}));

vi.mock("@/services/sessions", () => ({ sessionsApi: {
  getPortfolio: mocks.getPortfolio,
  regeneratePortfolio: mocks.regeneratePortfolio,
  get: mocks.getSession,
} }));
vi.mock("@/services/vacancies", () => ({ vacanciesApi: { list: mocks.listVacancies } }));
vi.mock("@/services/portfolios", () => ({ portfoliosApi: { exportPortfolio: mocks.exportPortfolio } }));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/4/sessions/7/portfolio"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/portfolio" element={<PortfolioPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PortfolioPage", () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPortfolio.mockResolvedValue({ data: { portfolio: {
      id: 1, generation_status: "failed", generation_error: "EnqueueFailed", skills: [], overrides: [],
    } } });
    mocks.listVacancies.mockResolvedValue({ data: { vacancies: [] } });
    mocks.getSession.mockResolvedValue({ data: { session: { candidate_name: "Synthetic candidate" } } });
  });

  it("keeps Retry available and explains an enqueue failure", async () => {
    mocks.regeneratePortfolio.mockRejectedValue(new Error("Synthetic queue outage"));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent", "Could not queue portfolio generation. Try again."
    );
    await waitFor(() => expect(mocks.regeneratePortfolio).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("shows a retry when the initial portfolio load fails", async () => {
    mocks.getPortfolio.mockRejectedValueOnce(new Error("Synthetic network outage"));
    renderPage();

    expect((await screen.findByRole("alert")).textContent).toContain("The portfolio could not be loaded.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(mocks.getPortfolio).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Portfolio generation failed.")).toBeTruthy();
  });

  it("explains an export failure while keeping the portfolio available", async () => {
    mocks.getPortfolio.mockResolvedValue({ data: { portfolio: {
      id: 1, generation_status: "complete", generation_error: null, skills: [], overrides: [],
    } } });
    mocks.exportPortfolio.mockRejectedValue(new Error("Synthetic export outage"));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "PDF" }));

    expect((await screen.findByRole("alert")).textContent).toContain("The export could not be downloaded.");
    expect(screen.getByRole("button", { name: "PDF" })).toBeTruthy();
  });

  it("keeps the prior complete portfolio visible during a refresh", async () => {
    mocks.getPortfolio.mockResolvedValue({ data: { portfolio: {
      id: 1, generation_status: "complete", generation_in_progress: true,
      generation_error: null, skills: [], overrides: [],
    } } });
    renderPage();

    expect(await screen.findByText("Refreshing portfolio...")).toBeTruthy();
    expect(screen.getByText("Configured Skills")).toBeTruthy();
  });

  it("lets the assessor retry a failed vacancy list", async () => {
    mocks.getPortfolio.mockResolvedValue({ data: { portfolio: {
      id: 1, generation_status: "complete", generation_error: null, skills: [], overrides: [],
    } } });
    mocks.listVacancies.mockRejectedValueOnce(new Error("Synthetic network outage"));
    renderPage();

    expect((await screen.findByRole("alert")).textContent).toContain("Vacancies could not be loaded.");
    fireEvent.click(screen.getByRole("button", { name: "Retry vacancies" }));
    await waitFor(() => expect(mocks.listVacancies).toHaveBeenCalledTimes(2));
  });
});
