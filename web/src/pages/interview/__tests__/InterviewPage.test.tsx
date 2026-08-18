import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InterviewPage from "@/pages/interview/InterviewPage";
import { sessionsApi } from "@/services/sessions";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import type { InterviewState } from "@/types";

// HardwareCheck does real browser media/audio work — irrelevant to the
// state-machine regressions under test (F12/F13/F19), so it's stubbed out.
// The onStart button lets connection_lost tests drive past the idle screen.
vi.mock("@/components/HardwareCheck", () => ({
  default: ({ onStart }: { onStart: () => void }) => (
    <div data-testid="hardware-check-stub">
      <button onClick={onStart}>Start (stub)</button>
    </div>
  ),
}));

vi.mock("@/services/sessions", () => ({
  sessionsApi: { getCandidateInfo: vi.fn(), audioComplete: vi.fn() },
}));

// Default stubs so the pre-existing F12/F13 tests below (which never reach
// the active-interview UI) don't have to know these hooks exist.
vi.mock("@/hooks/useAudioWebSocket", () => ({
  useAudioWebSocket: vi.fn(() => ({
    connect: vi.fn(),
    send: vi.fn(),
    sendJson: vi.fn(),
    disconnect: vi.fn(),
    connectionState: "disconnected",
  })),
}));

vi.mock("@/hooks/useAudioCapture", () => ({
  useAudioCapture: vi.fn(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    mute: vi.fn(),
    unmute: vi.fn(),
    isCapturing: false,
  })),
}));

vi.mock("@/hooks/useAudioPlayback", () => ({
  useAudioPlayback: vi.fn(() => ({
    playChunk: vi.fn(),
    stop: vi.fn(),
    scheduleAfterPlayback: vi.fn(),
    waitForDrain: vi.fn(),
    cancelDrain: vi.fn(),
  })),
}));

function renderInterviewPage(token = "some-token") {
  render(
    <MemoryRouter initialEntries={[`/interview/${token}`]}>
      <Routes>
        <Route path="/interview/:token" element={<InterviewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("InterviewPage — session status resolution (F12/F13 regression)", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.getCandidateInfo).mockReset();
  });

  it("F12: shows a loading state before the candidate-info fetch resolves, never flashing the hardware-check UI", () => {
    // Never-resolving promise — simulates the in-flight window before F12's fix.
    vi.mocked(sessionsApi.getCandidateInfo).mockReturnValue(new Promise(() => {}));

    renderInterviewPage();

    expect(screen.getByText(/loading interview/i)).toBeInTheDocument();
    expect(screen.queryByTestId("hardware-check-stub")).not.toBeInTheDocument();
    expect(screen.queryByText(/interview complete/i)).not.toBeInTheDocument();
  });

  it("F12: renders the hardware-check step only after the fetch resolves to a non-ended session", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: { session_id: 1, role_title: "Backend Engineer", time_limit_min: 30, session_status: "pending" },
    } as never);

    renderInterviewPage();

    expect(await screen.findByTestId("hardware-check-stub")).toBeInTheDocument();
    expect(screen.queryByText(/loading interview/i)).not.toBeInTheDocument();
  });

  it("F12: goes straight to 'Interview Complete' for an already-ended session, without ever rendering hardware-check", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: { session_id: 1, role_title: "Backend Engineer", time_limit_min: 30, session_status: "ended" },
    } as never);

    renderInterviewPage();

    expect(await screen.findByText(/interview complete/i)).toBeInTheDocument();
    expect(screen.queryByTestId("hardware-check-stub")).not.toBeInTheDocument();
  });

  it("F13: shows an explicit invalid-link error (not 'Interview Complete') when the token 404s", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockRejectedValue({
      response: { status: 404, data: { error: "This interview link is invalid or has expired." } },
    });

    renderInterviewPage("bogus-token");

    expect(await screen.findByText(/unable to load interview/i)).toBeInTheDocument();
    expect(screen.getByText(/this interview link is invalid or has expired/i)).toBeInTheDocument();
    expect(screen.queryByText(/^interview complete$/i)).not.toBeInTheDocument();
  });

  it("F13: shows a generic error (not 'Interview Complete') for a non-404 failure", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockRejectedValue({
      response: { status: 500, data: {} },
    });

    renderInterviewPage();

    expect(await screen.findByText(/unable to load interview/i)).toBeInTheDocument();
    expect(screen.getByText(/something went wrong loading this interview/i)).toBeInTheDocument();
    expect(screen.queryByText(/^interview complete$/i)).not.toBeInTheDocument();
  });
});

describe("InterviewPage — connection_lost state (F19)", () => {
  const connectMock = vi.fn();

  beforeEach(() => {
    vi.mocked(sessionsApi.getCandidateInfo).mockReset().mockResolvedValue({
      data: { session_id: 1, role_title: "Backend Engineer", time_limit_min: 30, session_status: "pending" },
    } as never);

    connectMock.mockReset();
    vi.mocked(useAudioWebSocket).mockReset().mockImplementation(({ onStateChange }) => {
      // Expose the state setter so tests can drive the hook's reported state,
      // the same way the real WebSocket's onclose handler would.
      (globalThis as { __onStateChange?: (s: InterviewState) => void }).__onStateChange = onStateChange;
      return { connect: connectMock, send: vi.fn(), sendJson: vi.fn(), disconnect: vi.fn(), connectionState: "connected" };
    });
    vi.mocked(useAudioCapture).mockReturnValue({
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
      mute: vi.fn(),
      unmute: vi.fn(),
      isCapturing: true,
    });
    vi.mocked(useAudioPlayback).mockReturnValue({
      playChunk: vi.fn(),
      stop: vi.fn(),
      scheduleAfterPlayback: vi.fn(),
      waitForDrain: vi.fn(),
      cancelDrain: vi.fn(),
    });
  });

  it("shows an honest 'connection lost' message with a reconnect action instead of 'Interview Complete'", async () => {
    const user = userEvent.setup();
    renderInterviewPage();

    await user.click(await screen.findByRole("button", { name: /start \(stub\)/i }));

    // Simulate the WS hook reporting exhausted reconnect attempts.
    act(() => {
      (globalThis as { __onStateChange?: (s: InterviewState) => void }).__onStateChange?.("connection_lost");
    });

    expect(await screen.findByText(/connection lost/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reconnect/i })).toBeInTheDocument();
    expect(screen.queryByText(/^interview complete$/i)).not.toBeInTheDocument();
  });

  it("retries the WebSocket connection when 'Reconnect' is clicked", async () => {
    const user = userEvent.setup();
    renderInterviewPage();

    await user.click(await screen.findByRole("button", { name: /start \(stub\)/i }));
    act(() => {
      (globalThis as { __onStateChange?: (s: InterviewState) => void }).__onStateChange?.("connection_lost");
    });
    connectMock.mockClear();

    await user.click(await screen.findByRole("button", { name: /reconnect/i }));

    expect(connectMock).toHaveBeenCalled();
  });
});

describe("InterviewPage — typed-answer fallback (F19)", () => {
  const sendJsonMock = vi.fn();

  beforeEach(() => {
    vi.mocked(sessionsApi.getCandidateInfo).mockReset().mockResolvedValue({
      data: { session_id: 1, role_title: "Backend Engineer", time_limit_min: 30, session_status: "pending" },
    } as never);

    sendJsonMock.mockReset();
    vi.mocked(useAudioWebSocket).mockReset().mockImplementation(({ onStateChange, onSpeakerChange, onError }) => {
      (globalThis as { __onStateChange?: (s: InterviewState) => void }).__onStateChange = onStateChange;
      (globalThis as { __onSpeakerChange?: (s: "ai" | "candidate" | null) => void }).__onSpeakerChange =
        onSpeakerChange;
      (globalThis as { __onError?: (message: string) => void }).__onError = onError;
      return { connect: vi.fn(), send: vi.fn(), sendJson: sendJsonMock, disconnect: vi.fn(), connectionState: "connected" };
    });
    vi.mocked(useAudioCapture).mockReturnValue({
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
      mute: vi.fn(),
      unmute: vi.fn(),
      isCapturing: true,
    });
    vi.mocked(useAudioPlayback).mockReturnValue({
      playChunk: vi.fn(),
      stop: vi.fn(),
      scheduleAfterPlayback: vi.fn(),
      waitForDrain: vi.fn(),
      cancelDrain: vi.fn(),
    });
  });

  async function startActiveInterview() {
    const user = userEvent.setup();
    renderInterviewPage();
    await user.click(await screen.findByRole("button", { name: /start \(stub\)/i }));
    act(() => {
      (globalThis as { __onStateChange?: (s: InterviewState) => void }).__onStateChange?.("active");
    });
    return user;
  }

  it("sends a text_input message when a typed answer is submitted", async () => {
    const user = await startActiveInterview();

    await user.type(screen.getByRole("textbox", { name: /type your answer/i }), "I'd use a queue.");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(sendJsonMock).toHaveBeenCalledWith({ type: "text_input", text: "I'd use a queue." });
  });

  it("disables the typed-answer input while the AI is speaking", async () => {
    await startActiveInterview();
    act(() => {
      (globalThis as { __onSpeakerChange?: (s: "ai" | "candidate" | null) => void }).__onSpeakerChange?.("ai");
    });

    expect(screen.getByRole("textbox", { name: /type your answer/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });

  it("shows a visible message instead of silently dropping a failed send (e.g. text_input rejected server-side)", async () => {
    await startActiveInterview();

    act(() => {
      (globalThis as { __onError?: (message: string) => void }).__onError?.(
        "Unable to send message — session is not connected."
      );
    });

    expect(
      await screen.findByText(/unable to send message — session is not connected\./i)
    ).toBeInTheDocument();
  });
});

describe("InterviewPage — End Interview race condition (F25)", () => {
  const sendJsonMock = vi.fn();
  const disconnectMock = vi.fn();

  beforeEach(() => {
    vi.mocked(sessionsApi.getCandidateInfo).mockReset().mockResolvedValue({
      data: { session_id: 1, role_title: "Backend Engineer", time_limit_min: 30, session_status: "pending" },
    } as never);

    sendJsonMock.mockReset();
    disconnectMock.mockReset();
    vi.mocked(useAudioWebSocket).mockReset().mockImplementation(({ onStateChange }) => {
      (globalThis as { __onStateChange?: (s: InterviewState) => void }).__onStateChange = onStateChange;
      return {
        connect: vi.fn(),
        send: vi.fn(),
        sendJson: sendJsonMock,
        disconnect: disconnectMock,
        connectionState: "connected",
      };
    });
    vi.mocked(useAudioCapture).mockReturnValue({
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
      mute: vi.fn(),
      unmute: vi.fn(),
      isCapturing: true,
    });
    vi.mocked(useAudioPlayback).mockReturnValue({
      playChunk: vi.fn(),
      stop: vi.fn(),
      scheduleAfterPlayback: vi.fn(),
      waitForDrain: vi.fn(),
      cancelDrain: vi.fn(),
    });
  });

  async function startActiveInterviewAndEndIt(user: ReturnType<typeof userEvent.setup>) {
    renderInterviewPage();
    await user.click(await screen.findByRole("button", { name: /start \(stub\)/i }));
    act(() => {
      (globalThis as { __onStateChange?: (s: InterviewState) => void }).__onStateChange?.("active");
    });

    // Trigger button reads "End Interview"; the AlertDialogAction that actually
    // confirms reads "End interview" (lowercase "interview") — match case-sensitively
    // so the two aren't ambiguous once both are in the DOM.
    await user.click(await screen.findByRole("button", { name: "End Interview" }));
    await user.click(await screen.findByRole("button", { name: "End interview" }));
  }

  it("does not disconnect locally right after sending end_session — waits for the backend's ack instead", async () => {
    const user = userEvent.setup();
    await startActiveInterviewAndEndIt(user);

    expect(sendJsonMock).toHaveBeenCalledWith({ type: "end_session" });
    // The F25 bug: disconnect() was called synchronously here, racing the backend's
    // session_ended ack and causing onclose to report connection_lost instead of complete.
    expect(disconnectMock).not.toHaveBeenCalled();
  });

  it("lands on 'Interview Complete' when the backend acks session_ended, not 'Connection lost'", async () => {
    const user = userEvent.setup();
    await startActiveInterviewAndEndIt(user);

    act(() => {
      (globalThis as { __onStateChange?: (s: InterviewState) => void }).__onStateChange?.("complete");
    });

    expect(await screen.findByText(/^interview complete$/i)).toBeInTheDocument();
    expect(screen.queryByText(/connection lost/i)).not.toBeInTheDocument();
  });

  it("falls back to a local disconnect + complete if the backend never acks within the safety window", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup();
    await startActiveInterviewAndEndIt(user);

    expect(disconnectMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });

    expect(disconnectMock).toHaveBeenCalled();
    expect(await screen.findByText(/^interview complete$/i)).toBeInTheDocument();

    vi.useRealTimers();
  });
});
