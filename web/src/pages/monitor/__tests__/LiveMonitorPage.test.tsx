import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LiveMonitorPage from "@/pages/monitor/LiveMonitorPage";
import { sessionsApi } from "@/services/sessions";
import { useCoverageWebSocket } from "@/hooks/useCoverageWebSocket";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

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

function renderLiveMonitorPage() {
  render(
    <MemoryRouter initialEntries={["/assessments/1/sessions/2/monitor"]}>
      <Routes>
        <Route path="/assessments/:id/sessions/:sessionId/monitor" element={<LiveMonitorPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("LiveMonitorPage", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    vi.mocked(sessionsApi.get).mockReset();
    vi.mocked(sessionsApi.getTranscript).mockReset();
    vi.mocked(sessionsApi.endSession).mockReset();
    vi.mocked(useCoverageWebSocket).mockReset();

    vi.mocked(useCoverageWebSocket).mockReturnValue({
      coverageMap: {
        skills: [
          {
            id: 1,
            skill_id: 10,
            skill_label: "React",
            is_discovered: false,
            state: "partial",
            probe_count: 2,
            last_signal: "Discussed hooks",
          },
        ],
        discovered: [],
      },
      sessionEnded: false,
      sessionEndReason: null,
      isConnected: true,
    });

    vi.mocked(sessionsApi.get).mockResolvedValue({
      data: {
        session: {
          id: 2,
          status: "active",
          started_at: new Date().toISOString(),
          assessment: { name: "Frontend Engineer" },
        },
      },
    } as never);

    vi.mocked(sessionsApi.getTranscript).mockResolvedValue({
      data: {
        turns: [
          { id: 1, turn_number: 1, speaker: "ai", text: "Tell me about yourself.", created_at: "" },
          { id: 2, turn_number: 2, speaker: "candidate", text: "I am a frontend engineer.", created_at: "" },
        ],
        total: 2,
      },
    } as never);
  });

  it("shows a loading state before data resolves", () => {
    vi.mocked(sessionsApi.get).mockReturnValue(new Promise(() => {}) as never);
    vi.mocked(sessionsApi.getTranscript).mockReturnValue(new Promise(() => {}) as never);

    renderLiveMonitorPage();

    expect(screen.queryByText("Live Monitor")).not.toBeInTheDocument();
  });

  it("renders session info, coverage skills, and transcript turns on success", async () => {
    renderLiveMonitorPage();

    expect(await screen.findByText("Live Monitor")).toBeInTheDocument();
    expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();

    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Discussed hooks", { exact: false })).toBeInTheDocument();

    expect(screen.getByText("Tell me about yourself.")).toBeInTheDocument();
    expect(screen.getByText("I am a frontend engineer.")).toBeInTheDocument();
  });

  it("ends the session and navigates to the portfolio page", async () => {
    vi.mocked(sessionsApi.endSession).mockResolvedValueOnce({
      data: { session: { id: 2, status: "ended" } },
    } as never);
    const user = userEvent.setup();

    renderLiveMonitorPage();

    await screen.findByText("Live Monitor");

    await user.click(screen.getByRole("button", { name: /end session/i }));
    await user.click(screen.getByRole("button", { name: "End Session" }));

    await waitFor(() => expect(sessionsApi.endSession).toHaveBeenCalledWith(2));
    expect(navigateMock).toHaveBeenCalledWith("/assessments/1/sessions/2/portfolio");
  });
});
