import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import InterviewPage from "@/pages/interview/InterviewPage";
import { sessionsApi } from "@/services/sessions";

// Regression coverage for assessment/03_defining_problem_and_gap_to_ideal_condition.md F2 and F6.
//
// F2: any failure loading candidate info used to collapse into the same
// "✅ Interview Complete" screen as a genuinely finished interview. A bad
// token must show "invalid link", and a transient failure must be retryable
// instead of terminal.
//
// F6: getUserMedia failing at the moment the interview actually starts (after
// HardwareCheck already passed) used to be silently swallowed, leaving the
// candidate stuck on "Connecting..." forever.

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getCandidateInfo: vi.fn(),
  },
}));

// HardwareCheck does its own internet-speed/camera/mic probing, out of scope
// for this test — replace with a button that immediately triggers onStart,
// so we can drive InterviewPage's own state machine (the thing F6 actually
// lives in) directly.
vi.mock("@/components/HardwareCheck", () => ({
  default: ({ onStart }: { onStart: () => void }) => (
    <button onClick={onStart}>Start Interview (mocked hardware check)</button>
  ),
}));

// Hoisted so tests can assert on WHEN the socket is opened relative to the mic.
const { connectMock } = vi.hoisted(() => ({ connectMock: vi.fn() }));

vi.mock("@/hooks/useAudioWebSocket", () => ({
  useAudioWebSocket: () => ({
    connect: connectMock,
    send: vi.fn(),
    sendJson: vi.fn(),
    disconnect: vi.fn(),
    connectionState: "connected",
  }),
}));

vi.mock("@/hooks/useAudioPlayback", () => ({
  useAudioPlayback: () => ({
    playChunk: vi.fn(),
    stop: vi.fn(),
    scheduleAfterPlayback: vi.fn(),
    waitForDrain: vi.fn(),
    cancelDrain: vi.fn(),
  }),
}));

function renderAtToken(token: string) {
  return render(
    <MemoryRouter initialEntries={[`/interview/${token}`]}>
      <Routes>
        <Route path="/interview/:token" element={<InterviewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("InterviewPage — candidate info failures (F2)", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.getCandidateInfo).mockReset();
  });

  it("shows an invalid-link screen for a 404, never the completion screen", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockRejectedValue({ response: { status: 404 } });

    renderAtToken("bad-token");

    expect(await screen.findByText(/this interview link is invalid/i)).toBeInTheDocument();
    expect(screen.queryByText(/interview complete/i)).not.toBeInTheDocument();
  });

  it("retries automatically on a transient failure, then offers a manual retry — never the completion screen", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockRejectedValue(new Error("network down"));

    renderAtToken("some-token");

    expect(await screen.findByText(/couldn't connect/i)).toBeInTheDocument();
    expect(screen.queryByText(/interview complete/i)).not.toBeInTheDocument();
    // 1 initial attempt + 2 automatic retries before giving up
    expect(sessionsApi.getCandidateInfo).toHaveBeenCalledTimes(3);
  });

  it("renders the real completion screen when the session genuinely already ended", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: { session_id: 1, role_title: "Senior Engineer", time_limit_min: 45, session_status: "ended" },
    } as any);

    renderAtToken("finished-token");

    expect(await screen.findByText(/interview complete/i)).toBeInTheDocument();
  });
});

describe("InterviewPage — microphone failure at start (F6)", () => {
  beforeEach(() => {
    connectMock.mockReset();
    vi.mocked(sessionsApi.getCandidateInfo).mockReset();
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: { session_id: 1, role_title: "Senior Engineer", time_limit_min: 45, session_status: "pending" },
    } as any);

    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException("Permission denied", "NotAllowedError")) },
    });
  });

  it("surfaces a recoverable error instead of hanging on Connecting forever", async () => {
    const user = userEvent.setup();
    renderAtToken("good-token");

    const startButton = await screen.findByText(/start interview \(mocked hardware check\)/i);
    await user.click(startButton);

    expect(await screen.findByText(/couldn't access your microphone/i)).toBeInTheDocument();
    expect(screen.queryByText(/^connecting\.\.\.$/i)).not.toBeInTheDocument();
  });

  // Reviewer feedback on F6: the socket used to be opened BEFORE the microphone
  // was acquired. The backend marks a session active as soon as the socket
  // connects, so a mic failure then left an active session behind that the
  // grace timer eventually ended. The mic must be secured first.
  it("never opens the WebSocket when the microphone cannot be acquired", async () => {
    const user = userEvent.setup();
    renderAtToken("good-token");

    await user.click(await screen.findByText(/start interview \(mocked hardware check\)/i));
    await screen.findByText(/couldn't access your microphone/i);

    expect(connectMock).not.toHaveBeenCalled();
  });

  it("opens the WebSocket only after the microphone has been acquired", async () => {
    class FakeAudioContext {
      audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
      createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
      close = vi.fn();
    }
    class FakeAudioWorkletNode {
      port = {};
      disconnect = vi.fn();
    }
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("AudioWorkletNode", FakeAudioWorkletNode);
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] });
    Object.defineProperty(globalThis.navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });

    const user = userEvent.setup();
    renderAtToken("good-token");
    await user.click(await screen.findByText(/start interview \(mocked hardware check\)/i));

    await vi.waitFor(() => expect(connectMock).toHaveBeenCalledTimes(1));
    expect(getUserMedia.mock.invocationCallOrder[0]).toBeLessThan(connectMock.mock.invocationCallOrder[0]);
    expect(screen.queryByText(/couldn't access your microphone/i)).not.toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
