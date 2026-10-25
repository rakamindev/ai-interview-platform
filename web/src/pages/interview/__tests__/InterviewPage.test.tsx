import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InterviewPage from "@/pages/interview/InterviewPage";
import { sessionsApi } from "@/services/sessions";

const captureMocks = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  mute: vi.fn(),
  unmute: vi.fn(),
}));

const playbackMocks = vi.hoisted(() => ({
  playChunk: vi.fn(),
  stop: vi.fn(),
  scheduleAfterPlayback: vi.fn(),
  waitForDrain: vi.fn(),
  cancelDrain: vi.fn(),
}));

const websocketMocks = vi.hoisted(() => ({
  connect: vi.fn(),
  send: vi.fn(),
  sendJson: vi.fn(),
  disconnect: vi.fn(),
  options: null as Record<string, (...args: any[]) => void> | null,
}));

const verifiedMicrophone = vi.hoisted(() => {
  const track = {
    kind: "audio",
    label: "Verified microphone",
    readyState: "live",
    stop: vi.fn(),
    getSettings: () => ({ deviceId: "verified-device" }),
  } as unknown as MediaStreamTrack;
  const stream = {
    id: "verified-stream",
    getTracks: () => [track],
    getAudioTracks: () => [track],
    getVideoTracks: () => [],
  } as unknown as MediaStream;
  return { stream, deviceId: "verified-device", label: "Verified microphone" };
});

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getCandidateInfo: vi.fn(),
    audioComplete: vi.fn(),
  },
}));

vi.mock("@/hooks/useAudioWebSocket", () => ({
  useAudioWebSocket: (options: Record<string, (...args: any[]) => void>) => {
    websocketMocks.options = options;
    return {
    connect: websocketMocks.connect,
    send: websocketMocks.send,
    sendJson: websocketMocks.sendJson,
    disconnect: websocketMocks.disconnect,
    connectionState: "disconnected",
    };
  },
}));

vi.mock("@/hooks/useAudioCapture", () => ({
  useAudioCapture: () => ({
    start: captureMocks.start,
    stop: captureMocks.stop,
    mute: captureMocks.mute,
    unmute: captureMocks.unmute,
    isCapturing: false,
  }),
}));

vi.mock("@/hooks/useAudioPlayback", () => ({
  useAudioPlayback: () => ({
    playChunk: playbackMocks.playChunk,
    stop: playbackMocks.stop,
    scheduleAfterPlayback: playbackMocks.scheduleAfterPlayback,
    waitForDrain: playbackMocks.waitForDrain,
    cancelDrain: playbackMocks.cancelDrain,
  }),
}));

vi.mock("@/components/HardwareCheck", () => ({
  default: ({ onStart }: { onStart: (microphone: typeof verifiedMicrophone) => void }) => (
    <button onClick={() => onStart(verifiedMicrophone)}>Start Interview</button>
  ),
}));

beforeEach(() => {
  captureMocks.start.mockResolvedValue({ source: "verified", deviceChanged: false });
  playbackMocks.scheduleAfterPlayback.mockImplementation((callback: () => void) => callback());
  websocketMocks.options = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

function renderInterview(token = "tok123") {
  return render(
    <MemoryRouter initialEntries={[`/interview/${token}`]}>
      <Routes>
        <Route path="/interview/:token" element={<InterviewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("InterviewPage — failure paths (F-07)", () => {
  it("renders load-failure error with retry when fetch fails (network error)", async () => {
    (sessionsApi.getCandidateInfo as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network down")
    );

    renderInterview();

    expect(await screen.findByRole("heading", { name: "Couldn't load your interview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
  });

  it("renders auth-failed error WITHOUT retry for 401/404", async () => {
    (sessionsApi.getCandidateInfo as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: { status: 404 },
    });

    renderInterview();

    expect(await screen.findByRole("heading", { name: "This interview link isn't valid" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Try again/i })).not.toBeInTheDocument();
  });

  it("retry re-runs the fetch after a load failure", async () => {
    const mock = sessionsApi.getCandidateInfo as ReturnType<typeof vi.fn>;
    mock.mockRejectedValueOnce(new Error("network down")).mockResolvedValueOnce({
      data: { session_id: 7, role_title: "Backend Engineer", time_limit_min: 30, session_status: "pending" },
    });

    renderInterview();

    // First attempt fails → error screen.
    expect(await screen.findByRole("heading", { name: "Couldn't load your interview" })).toBeInTheDocument();

    const userEventModule = await import("@testing-library/user-event");
    const user = userEventModule.default.setup();
    await user.click(screen.getByRole("button", { name: /Try again/i }));

    // After a successful retry, the pre-start screen shows role title + Start.
    await screen.findByText("Backend Engineer");
    expect(screen.getByRole("button", { name: /Start Interview/i })).toBeInTheDocument();
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("shows the pre-start (idle) screen when the fetch succeeds", async () => {
    (sessionsApi.getCandidateInfo as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { session_id: 1, role_title: "Data Analyst", time_limit_min: 20, session_status: "pending" },
    });

    renderInterview();

    await waitFor(() => {
      expect(screen.getByText("Data Analyst")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Start Interview/i })).toBeInTheDocument();
  });

  it("shows an active session as a resume with server time and recent transcript", async () => {
    (sessionsApi.getCandidateInfo as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        session_id: 8,
        role_title: "Backend Engineer",
        time_limit_min: 30,
        session_status: "active",
        deadline_at: new Date(Date.now() + 12 * 60 * 1000).toISOString(),
        remaining_seconds: 720,
        resume_available: true,
        recent_transcript: [
          {
            id: 41,
            turn_number: 4,
            speaker: "ai",
            text: "Tell me how you handled that failure.",
            created_at: new Date().toISOString(),
          },
        ],
      },
    });

    renderInterview();

    expect(await screen.findByRole("heading", { name: "Resume interview" })).toBeInTheDocument();
    expect(screen.getByText("Tell me how you handled that failure.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Recent conversation restored");
    expect(screen.getByRole("button", { name: "Resume interview" })).toBeInTheDocument();
    expect(screen.queryByText("OS & browser")).not.toBeInTheDocument();
  });

  it("shows a truthful terminal recovery state when AI context is unavailable", async () => {
    (sessionsApi.getCandidateInfo as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        session_id: 9,
        role_title: "Backend Engineer",
        time_limit_min: 30,
        session_status: "active",
        deadline_at: new Date(Date.now() + 12 * 60 * 1000).toISOString(),
        remaining_seconds: 720,
        resume_available: false,
        recovery_message: "The prior AI conversation context is unavailable.",
        recent_transcript: [],
      },
    });

    renderInterview();

    expect(
      await screen.findByRole("heading", { name: "Interview context couldn't be restored" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume interview" })).not.toBeInTheDocument();
  });
});

describe("InterviewPage — microphone handoff", () => {
  beforeEach(() => {
    (sessionsApi.getCandidateInfo as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { session_id: 38, role_title: "Frontend Engineer", time_limit_min: 20, session_status: "pending" },
    });
  });

  it("passes the verified microphone to capture and closes the gate before capture starts", async () => {
    const userEventModule = await import("@testing-library/user-event");
    const user = userEventModule.default.setup();
    renderInterview();

    await user.click(await screen.findByRole("button", { name: "Start Interview" }));

    expect(captureMocks.start).toHaveBeenCalledWith(verifiedMicrophone);
    expect(captureMocks.mute).toHaveBeenCalledTimes(1);
    expect(captureMocks.mute.mock.invocationCallOrder[0]).toBeLessThan(
      captureMocks.start.mock.invocationCallOrder[0]
    );
    expect(websocketMocks.connect).toHaveBeenCalledTimes(1);
  });

  it("does not open the candidate gate on session_started and only unmutes on speaker authorization", async () => {
    const userEventModule = await import("@testing-library/user-event");
    const user = userEventModule.default.setup();
    renderInterview();
    await user.click(await screen.findByRole("button", { name: "Start Interview" }));

    act(() => websocketMocks.options?.onStateChange("active"));
    expect(captureMocks.unmute).not.toHaveBeenCalled();

    act(() => websocketMocks.options?.onSpeakerChange("candidate"));
    expect(captureMocks.unmute).toHaveBeenCalledTimes(1);
  });

  it("tells the candidate when an ended verified track requires a different fallback device", async () => {
    captureMocks.start.mockResolvedValueOnce({
      source: "fallback",
      deviceChanged: true,
      label: "USB microphone",
    });
    const userEventModule = await import("@testing-library/user-event");
    const user = userEventModule.default.setup();
    renderInterview();

    await user.click(await screen.findByRole("button", { name: "Start Interview" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "The verified microphone disconnected. Your browser switched to another input (USB microphone)."
    );
  });
});
