import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { renderWithProviders } from "@/test/utils";
import { fireEvent, screen, within } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import LiveMonitorPage from "./LiveMonitorPage";
import type { TranscriptTurn } from "@/types";

const { sessionsApiMock, wsState } = vi.hoisted(() => {
  const sessionsApiMock = {
    get: vi.fn(),
    live: vi.fn(),
    endSession: vi.fn(),
    revoke: vi.fn(),
    getCoverage: vi.fn(),
    getTranscript: vi.fn(),
    getPortfolio: vi.fn(),
    regeneratePortfolio: vi.fn(),
    getCandidateInfo: vi.fn(),
    audioComplete: vi.fn(),
  };
  const wsState = {
    coverageMap: null as {
      skills: Array<{
        id: number;
        skill_label: string;
        state: string;
        probe_count: number;
        last_signal?: string;
      }>;
      discovered: Array<{ id: number; skill_label: string; state: string; probe_count: number }>;
    } | null,
    sessionEnded: false,
    sessionEndReason: null as string | null,
    isConnected: true,
    liveTurn: null as TranscriptTurn | null,
  };
  return { sessionsApiMock, wsState };
});

vi.mock("@/services/sessions", () => ({ sessionsApi: sessionsApiMock }));
vi.mock("@/hooks/useCoverageWebSocket", () => ({
  useCoverageWebSocket: () => wsState,
}));

const session = {
  id: 42,
  status: "active",
  candidate_name: "Siti",
  started_at: "2025-01-01T00:00:00Z",
  assessment: { name: "Backend Assessment", role_title: "Backend Engineer", time_limit_min: 45 },
};

const turns: TranscriptTurn[] = [
  { id: 1, turn_number: 1, speaker: "ai", text: "Welcome.", created_at: "2025-01-01T00:00:00Z" },
  {
    id: 2,
    turn_number: 2,
    speaker: "candidate",
    text: "Hi there.",
    created_at: "2025-01-01T00:00:01Z",
  },
];

const coverage = {
  skills: [
    { id: 1, skill_label: "SQL", state: "partial", probe_count: 2, last_signal: "used joins" },
    { id: 2, skill_label: "React", state: "covered", probe_count: 1 },
  ],
  discovered: [{ id: 3, skill_label: "System Design", state: "initiated", probe_count: 0 }],
};

function mockMonitor(overrides: { status?: string; turns?: TranscriptTurn[] } = {}) {
  sessionsApiMock.get.mockResolvedValue({
    data: { session: { ...session, status: overrides.status ?? "active" } },
  });
  sessionsApiMock.getTranscript.mockResolvedValue({ data: { turns: overrides.turns ?? turns } });
  sessionsApiMock.endSession.mockResolvedValue({ data: {} });
}

function renderMonitor(route = "/assessments/9/sessions/42/monitor") {
  const ui = (
    <Routes>
      <Route path="/assessments/:id/sessions/:sessionId/monitor" element={<LiveMonitorPage />} />
      <Route
        path="/assessments/:id/sessions/:sessionId/portfolio"
        element={<div>PORTFOLIO PAGE</div>}
      />
    </Routes>
  );
  return { ui, ...renderWithProviders(ui, { route }) };
}

describe("LiveMonitorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wsState.coverageMap = null;
    wsState.sessionEnded = false;
    wsState.sessionEndReason = null;
    wsState.isConnected = true;
    wsState.liveTurn = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders loading skeletons while fetching", () => {
    sessionsApiMock.get.mockReturnValue(new Promise(() => {}));
    renderMonitor();

    expect(document.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });

  it("renders the monitor header with session details", async () => {
    mockMonitor();
    renderMonitor();

    expect(await screen.findByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("Siti")).toBeInTheDocument();
    expect(screen.getByText("Backend Assessment")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Waiting for interview to begin...")).toBeInTheDocument();
  });

  it("renders the coverage map with priority and discovered skills", async () => {
    wsState.coverageMap = coverage;
    mockMonitor();
    renderMonitor();

    expect(await screen.findByText("Coverage Status")).toBeInTheDocument();
    expect(screen.getByText("Priority next:")).toBeInTheDocument();
    expect(screen.getAllByText("SQL").length).toBeGreaterThan(0);
    expect(screen.getByText("2 probes")).toBeInTheDocument();
    expect(screen.getByText("Discovered")).toBeInTheDocument();
    expect(screen.getByText("System Design")).toBeInTheDocument();
  });

  it("renders the live transcript", async () => {
    mockMonitor();
    renderMonitor();

    expect(await screen.findByText("Welcome.")).toBeInTheDocument();
    expect(screen.getByText("Hi there.")).toBeInTheDocument();
  });

  it("appends turns streamed over the WebSocket", async () => {
    mockMonitor();
    renderMonitor();
    await screen.findByText("Hi there.");

    wsState.liveTurn = {
      id: 3,
      turn_number: 3,
      speaker: "candidate",
      text: "Streamed turn.",
      created_at: "2025-01-01T00:00:02Z",
    };
    fireEvent.click(screen.getByRole("button", { name: /Auto-scroll/ }));

    expect(await screen.findByText("Streamed turn.")).toBeInTheDocument();
  });

  it("shows the session-ended banner with the reason", async () => {
    wsState.sessionEnded = true;
    wsState.sessionEndReason = "interview_completed";
    mockMonitor({ status: "completed" });
    renderMonitor();

    expect(await screen.findByText("Session ended")).toBeInTheDocument();
    expect(screen.getByText("— interview completed")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /View portfolio/ }).length).toBeGreaterThan(0);
  });

  it("toggles auto-scroll", async () => {
    mockMonitor();
    renderMonitor();
    await screen.findByText("Coverage Status");

    const toggle = screen.getByRole("button", { name: /Auto-scroll/ });
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Auto-scroll off" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("ends the session and navigates to the portfolio", async () => {
    mockMonitor();
    renderMonitor();
    await screen.findByText("Coverage Status");

    fireEvent.click(screen.getByRole("button", { name: "End Session" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "End Session" }));

    expect(await screen.findByText("PORTFOLIO PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(sessionsApiMock.endSession).toHaveBeenCalledWith(42);
  });

  it("surfaces an error when ending the session fails", async () => {
    mockMonitor();
    sessionsApiMock.endSession.mockRejectedValue(new Error("boom"));
    renderMonitor();
    await screen.findByText("Coverage Status");

    fireEvent.click(screen.getByRole("button", { name: "End Session" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "End Session" }));

    expect(await screen.findByText("Failed to end session. Please try again.")).toBeInTheDocument();
  });

  it("shows a portfolio shortcut when the session is not active", async () => {
    mockMonitor({ status: "ended" });
    renderMonitor();

    expect(await screen.findByRole("button", { name: /View portfolio/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "End Session" })).not.toBeInTheDocument();
  });

  it("navigates to the portfolio from the ended-session shortcut", async () => {
    mockMonitor({ status: "ended" });
    renderMonitor();

    fireEvent.click(await screen.findByRole("button", { name: /View portfolio/ }));
    expect(await screen.findByText("PORTFOLIO PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it("navigates to the portfolio from the session-ended banner", async () => {
    wsState.sessionEnded = true;
    mockMonitor({ status: "completed" });
    renderMonitor();

    fireEvent.click((await screen.findAllByRole("button", { name: /View portfolio/ }))[0]);
    expect(await screen.findByText("PORTFOLIO PAGE", {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it("omits the priority suggestion when every skill is covered", async () => {
    wsState.coverageMap = {
      skills: [
        { id: 1, skill_label: "SQL", state: "covered", probe_count: 2 },
        { id: 2, skill_label: "React", state: "covered", probe_count: 1 },
      ],
      discovered: [],
    };
    mockMonitor();
    renderMonitor();

    await screen.findByText("Coverage Status");
    expect(screen.queryByText("Priority next:")).not.toBeInTheDocument();
  });
});
