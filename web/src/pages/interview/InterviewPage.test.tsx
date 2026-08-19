import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { renderWithProviders } from "@/test/utils";
import { act, fireEvent, screen } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import InterviewPage from "./InterviewPage";

const { sessionsApiMock, wsCallbacks, wsMock, captureMock, playbackMock, drainCallbacks } =
  vi.hoisted(() => {
    const wsCallbacks: { current: Record<string, unknown> } = { current: {} };
    const wsMock = {
      connect: vi.fn(),
      send: vi.fn(),
      sendJson: vi.fn(),
      disconnect: vi.fn(),
      connectionState: "connected",
    };
    const captureMock = { start: vi.fn(), stop: vi.fn(), mute: vi.fn(), unmute: vi.fn() };
    const drainCallbacks: Array<() => void> = [];
    const playbackMock = {
      playChunk: vi.fn(),
      stop: vi.fn(),
      scheduleAfterPlayback: vi.fn((cb: () => void) => cb()),
      waitForDrain: vi.fn((cb: () => void) => drainCallbacks.push(cb)),
      cancelDrain: vi.fn(),
    };
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
    return { sessionsApiMock, wsCallbacks, wsMock, captureMock, playbackMock, drainCallbacks };
  });

vi.mock("@/services/sessions", () => ({ sessionsApi: sessionsApiMock }));
vi.mock("@/hooks/useAudioWebSocket", () => ({
  useAudioWebSocket: (opts: Record<string, unknown>) => {
    wsCallbacks.current = opts;
    return wsMock;
  },
}));
vi.mock("@/hooks/useAudioCapture", () => ({ useAudioCapture: () => captureMock }));
vi.mock("@/hooks/useAudioPlayback", () => ({ useAudioPlayback: () => playbackMock }));
vi.mock("@/components/HardwareCheck", () => ({
  default: ({ onStart }: { onStart: () => void }) => (
    <button type="button" onClick={() => onStart()}>
      Run hardware check
    </button>
  ),
}));

const candidateInfo = {
  session_id: 1,
  role_title: "Backend Engineer",
  time_limit_min: 45,
  session_status: "active",
};

function mockInfo(status = "active") {
  sessionsApiMock.getCandidateInfo.mockResolvedValue({
    data: { ...candidateInfo, session_status: status },
  });
  sessionsApiMock.audioComplete.mockResolvedValue({ data: {} });
}

function renderInterview() {
  renderWithProviders(
    <Routes>
      <Route path="/interview/:token" element={<InterviewPage />} />
    </Routes>,
    { route: "/interview/abc123" },
  );
}

describe("InterviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    drainCallbacks.length = 0;
    wsCallbacks.current = {};
    wsMock.connectionState = "connected";
    mockInfo();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders the idle state with candidate info", async () => {
    renderInterview();

    expect(await screen.findByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("45 minutes")).toBeInTheDocument();
    expect(screen.getByText("Run hardware check")).toBeInTheDocument();
  });

  it("starts the interview from the hardware check and connects", async () => {
    renderInterview();
    await screen.findByText("Run hardware check");

    fireEvent.click(screen.getByText("Run hardware check"));

    expect(await screen.findByText("Connecting...", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(wsMock.connect).toHaveBeenCalled();
    expect(captureMock.start).toHaveBeenCalled();
  });

  it("renders the active state with transcript and mic toggle", async () => {
    renderInterview();
    await screen.findByText("Backend Engineer");
    fireEvent.click(screen.getByText("Run hardware check"));
    await screen.findByText("Connecting...", {}, { timeout: 5000 });

    act(() => {
      (wsCallbacks.current.onStateChange as (s: string) => void)("active");
      (wsCallbacks.current.onTranscript as (t: { speaker: string; text: string }) => void)({
        speaker: "candidate",
        text: "I handled the migration.",
      });
    });

    expect(await screen.findByText("I handled the migration.")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Listening...")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Mic On/ }));
    expect(captureMock.mute).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Muted/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Muted/ }));
    expect(captureMock.unmute).toHaveBeenCalled();
  });

  it("drains audio and calls audio_complete when the backend ends the interview", async () => {
    renderInterview();
    await screen.findByText("Backend Engineer");
    fireEvent.click(screen.getByText("Run hardware check"));
    await screen.findByText("Connecting...", {}, { timeout: 5000 });

    act(() => {
      (wsCallbacks.current.onStateChange as (s: string) => void)("draining_audio");
    });

    expect(screen.getByText("Wrapping up...")).toBeInTheDocument();
    expect(drainCallbacks.length).toBe(1);

    act(() => {
      drainCallbacks[0]();
    });

    await vi.waitFor(() => {
      expect(sessionsApiMock.audioComplete).toHaveBeenCalledWith("abc123");
    });
    expect(playbackMock.cancelDrain).toHaveBeenCalled();
  });

  it("calls audio_complete via the safety timeout when drain never fires", async () => {
    renderInterview();
    await screen.findByText("Backend Engineer");
    fireEvent.click(screen.getByText("Run hardware check"));
    await screen.findByText("Connecting...", {}, { timeout: 5000 });

    vi.useFakeTimers();
    act(() => {
      (wsCallbacks.current.onStateChange as (s: string) => void)("draining_audio");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(sessionsApiMock.audioComplete).toHaveBeenCalledWith("abc123");
  });

  it("shows the reconnecting banner and long-lost warning", async () => {
    renderInterview();
    await screen.findByText("Backend Engineer");
    fireEvent.click(screen.getByText("Run hardware check"));
    await screen.findByText("Connecting...", {}, { timeout: 5000 });

    vi.useFakeTimers();
    act(() => {
      (wsCallbacks.current.onStateChange as (s: string) => void)("reconnecting");
    });

    expect(screen.getByText("Briefly reconnecting — please wait a moment.")).toBeInTheDocument();
    expect(wsMock.connect).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(
      screen.getByText(
        "Connection is taking too long to restore. Please wait, and contact the interviewer if this persists.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the reconnected prompt and dismisses it", async () => {
    renderInterview();
    await screen.findByText("Backend Engineer");
    fireEvent.click(screen.getByText("Run hardware check"));
    await screen.findByText("Connecting...", {}, { timeout: 5000 });

    act(() => {
      (wsCallbacks.current.onStateChange as (s: string) => void)("active");
    });
    act(() => {
      (wsCallbacks.current.onReconnected as () => void)();
    });

    expect(screen.getByText(/Reconnected — please say/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "✕" }));
    expect(screen.queryByText(/Reconnected — please say/)).not.toBeInTheDocument();
  });

  it("marks the speaker as candidate after playback schedules the transition", async () => {
    renderInterview();
    await screen.findByText("Backend Engineer");
    fireEvent.click(screen.getByText("Run hardware check"));
    await screen.findByText("Connecting...", {}, { timeout: 5000 });

    act(() => {
      (wsCallbacks.current.onStateChange as (s: string) => void)("active");
      (wsCallbacks.current.onSpeakerChange as (s: string) => void)("candidate");
    });

    expect(await screen.findByText("You're speaking")).toBeInTheDocument();
  });

  it("shows the complete screen when the session already ended", async () => {
    mockInfo("ended");
    renderInterview();

    expect(await screen.findByText("Interview Complete")).toBeInTheDocument();
  });

  it("ends the interview from the confirmation dialog", async () => {
    renderInterview();
    await screen.findByText("Backend Engineer");
    fireEvent.click(screen.getByText("Run hardware check"));
    await screen.findByText("Connecting...", {}, { timeout: 5000 });

    fireEvent.click(screen.getByRole("button", { name: "End Interview" }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getAllByRole("button", { name: "End interview" })[0]);

    expect(await screen.findByText("Interview Complete")).toBeInTheDocument();
    expect(wsMock.sendJson).toHaveBeenCalledWith({ type: "end_session" });
    expect(wsMock.disconnect).toHaveBeenCalled();
    expect(captureMock.stop).toHaveBeenCalled();
    expect(playbackMock.stop).toHaveBeenCalled();
  });

  it("marks the speaker as AI and mutes the microphone", async () => {
    renderInterview();
    await screen.findByText("Backend Engineer");
    fireEvent.click(screen.getByText("Run hardware check"));
    await screen.findByText("Connecting...", {}, { timeout: 5000 });

    act(() => {
      (wsCallbacks.current.onStateChange as (s: string) => void)("active");
      (wsCallbacks.current.onSpeakerChange as (s: string) => void)("ai");
    });

    expect(await screen.findByText("AI speaking")).toBeInTheDocument();
    expect(captureMock.mute).toHaveBeenCalled();
  });

  it("forces a reconnect from the dev-only button", async () => {
    renderInterview();
    await screen.findByText("Backend Engineer");
    fireEvent.click(screen.getByText("Run hardware check"));
    await screen.findByText("Connecting...", {}, { timeout: 5000 });

    fireEvent.click(screen.getByRole("button", { name: "⚡ Force reconnect" }));

    expect(wsMock.sendJson).toHaveBeenCalledWith({ type: "debug_force_reconnect" });
  });
});
