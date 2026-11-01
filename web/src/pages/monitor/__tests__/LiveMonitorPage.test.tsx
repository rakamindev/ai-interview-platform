import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LiveMonitorPage from "@/pages/monitor/LiveMonitorPage";
import { sessionsApi } from "@/services/sessions";
import { useCoverageWebSocket } from "@/hooks/useCoverageWebSocket";

// Regression coverage for assessment/03_defining_problem_and_gap_to_ideal_condition.md F5:
// the "Live" badge only checked the WebSocket connection state, not whether
// the session itself was actually active — so a session that never started
// (or already ended) still showed a green "● Live" badge, contradicting the
// "Waiting for interview to begin..." text right below it.

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    get: vi.fn(),
    getTranscript: vi.fn(),
    endSession: vi.fn(),
  },
}));

vi.mock("@/hooks/useCoverageWebSocket", () => ({
  useCoverageWebSocket: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/2/monitor"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/monitor" element={<LiveMonitorPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("LiveMonitorPage — Live badge reflects session status (F5)", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.getTranscript).mockResolvedValue({ data: { turns: [], total: 0 } } as any);
    vi.mocked(useCoverageWebSocket).mockReturnValue({
      coverageMap: null,
      sessionEnded: false,
      sessionEndReason: null,
      isConnected: true, // WebSocket IS connected — this is the part that used to be enough on its own
    });
  });

  it("does not show Live when the session hasn't started yet, even if the WebSocket is connected", async () => {
    vi.mocked(sessionsApi.get).mockResolvedValue({
      data: { session: { status: "pending", started_at: null, assessment: { name: "Test" } } },
    } as any);

    renderPage();

    expect(await screen.findByText(/waiting for interview to begin/i)).toBeInTheDocument();
    expect(screen.queryByText(/^live$/i)).not.toBeInTheDocument();
  });

  it("shows Live when the session is genuinely active and the WebSocket is connected", async () => {
    vi.mocked(sessionsApi.get).mockResolvedValue({
      data: { session: { status: "active", started_at: new Date().toISOString(), assessment: { name: "Test" } } },
    } as any);

    renderPage();

    expect(await screen.findByText(/^live$/i)).toBeInTheDocument();
  });
});
