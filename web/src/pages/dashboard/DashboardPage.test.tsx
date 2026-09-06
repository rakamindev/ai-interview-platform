import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import DashboardPage from "./DashboardPage";
import { dashboardApi } from "@/services/dashboard";

vi.mock("@/services/dashboard", () => ({
  dashboardApi: { stats: vi.fn(), assessment: vi.fn() },
}));

const statsMock = dashboardApi.stats as unknown as ReturnType<typeof vi.fn>;

const stats = {
  total: 5,
  started: 4,
  completion_rate: 33.3,
  avg_duration_seconds: 1800,
  totals: { pending: 2, active: 1, ended: 1, failed: 1 },
  ended_reasons: [
    { reason: "all_covered", count: 1 },
    { reason: "error", count: 1 },
  ],
  live_sessions: [
    {
      id: 42,
      assessment_id: 3,
      assessment_name: "Data Engineer",
      candidate_name: "Siti",
      started_at: "2026-01-02T09:00:00Z",
    },
  ],
  per_assessment: [
    {
      id: 3,
      name: "Data Engineer",
      total: 5,
      started: 4,
      completion_rate: 33.3,
      avg_duration_seconds: 1800,
      totals: { pending: 2, active: 1, ended: 1, failed: 1 },
      ended_reasons: [
        { reason: "all_covered", count: 1 },
        { reason: "error", count: 1 },
      ],
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    statsMock.mockResolvedValue({ data: stats });
  });

  it("renders global stat cards", async () => {
    renderPage();

    expect(await screen.findByText("Total candidates")).toBeInTheDocument();
    expect(screen.getByText("Live now")).toBeInTheDocument();
    expect(screen.getByText("Awaiting candidate")).toBeInTheDocument();
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Failed").length).toBeGreaterThan(0);
    expect(screen.getByText("Completion rate")).toBeInTheDocument();
    expect(screen.getByText("Avg duration")).toBeInTheDocument();
    expect(screen.getAllByText("33.3%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("30m").length).toBeGreaterThan(0);
    expect(screen.getByText(/All skills covered/)).toBeInTheDocument();
    expect(screen.getByText("Ended reasons")).toBeInTheDocument();
  });

  it("lists currently interviewing candidates", async () => {
    renderPage();

    expect(await screen.findByText("Currently interviewing")).toBeInTheDocument();
    expect(screen.getByText("Siti")).toBeInTheDocument();
    expect(screen.getAllByText(/Data Engineer/).length).toBeGreaterThan(0);
  });

  it("renders the per-assessment table with counts", async () => {
    renderPage();

    expect(await screen.findByText("Per assessment")).toBeInTheDocument();
    expect(screen.getByText("Data Engineer")).toBeInTheDocument();
    expect(screen.getAllByText("5").length).toBeGreaterThan(0);
  });

  it("shows an error state when loading fails", async () => {
    statsMock.mockRejectedValue(new Error("boom"));
    renderPage();

    expect(
      await screen.findByText("Failed to load dashboard. Please refresh the page.")
    ).toBeInTheDocument();
  });

  it("shows an empty state when there are no assessments", async () => {
    statsMock.mockResolvedValue({
      data: {
        total: 0,
        started: 0,
        completion_rate: null,
        avg_duration_seconds: null,
        totals: { pending: 0, active: 0, ended: 0, failed: 0 },
        ended_reasons: [],
        live_sessions: [],
        per_assessment: [],
      },
    });
    renderPage();

    expect(
      await screen.findByText(/Create one to start inviting candidates/i)
    ).toBeInTheDocument();
    expect(screen.queryByText("Currently interviewing")).not.toBeInTheDocument();
  });
});