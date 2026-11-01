import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import InterviewPage from "@/pages/interview/InterviewPage";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";
import { sessionsApi } from "@/services/sessions";
import type { CandidateInfo } from "@/types";

vi.mock("@/services/sessions", () => ({
  sessionsApi: { getCandidateInfo: vi.fn(), audioComplete: vi.fn() },
}));

vi.mock("@/hooks/useAudioWebSocket", () => ({ useAudioWebSocket: vi.fn() }));

vi.mock("@/hooks/useAudioPlayback", () => ({
  useAudioPlayback: () => ({
    playChunk: vi.fn(),
    stop: vi.fn(),
    // Playback is instant in tests, so the candidate's turn starts right away.
    scheduleAfterPlayback: (callback: () => void) => callback(),
    waitForDrain: vi.fn(),
    cancelDrain: vi.fn(),
  }),
}));

const startCapture = vi.hoisted(() => vi.fn());
const stopCapture = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useAudioCapture", () => ({
  useAudioCapture: () => ({
    start: startCapture,
    stop: stopCapture,
    mute: vi.fn(),
    unmute: vi.fn(),
  }),
}));

vi.mock("@/components/HardwareCheck", () => ({
  default: ({ onStart }: { onStart?: () => void }) => (
    <button onClick={onStart}>Hardware checks done</button>
  ),
}));

function httpError(status?: number) {
  const config = { headers: new AxiosHeaders() };
  if (!status) return new AxiosError("Network Error", "ERR_NETWORK", config);
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data: {},
  });
}

type SocketOptions = Parameters<typeof useAudioWebSocket>[0];

const connect = vi.fn();

function renderPage() {
  let options: SocketOptions | undefined;
  vi.mocked(useAudioWebSocket).mockImplementation((opts) => {
    options = opts;
    return {
      connect,
      send: vi.fn(),
      sendJson: vi.fn(),
      disconnect: vi.fn(),
      connectionState: "disconnected",
    };
  });

  render(
    <MemoryRouter initialEntries={["/interview/invite-token"]}>
      <Routes>
        <Route path="/interview/:token" element={<InterviewPage />} />
      </Routes>
    </MemoryRouter>,
  );

  return () => options as SocketOptions;
}

describe("InterviewPage end screen", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: {
        session_id: 3,
        role_title: "Frontend Engineer",
        time_limit_min: 45,
        session_status: "active",
        in_use_elsewhere: false,
      },
    } as Awaited<ReturnType<typeof sessionsApi.getCandidateInfo>>);
  });

  it("tells the candidate the interview could not continue when the session failed", async () => {
    const socketOptions = renderPage();
    await waitFor(() => expect(sessionsApi.getCandidateInfo).toHaveBeenCalled());

    act(() => {
      socketOptions().onSessionFailed?.();
      socketOptions().onStateChange("complete");
    });

    expect(screen.getByText("Interview Could Not Continue")).toBeInTheDocument();
    expect(screen.queryByText("Interview Complete")).not.toBeInTheDocument();
  });

  it("shows the completion screen when the session ends normally", async () => {
    const socketOptions = renderPage();
    await waitFor(() => expect(sessionsApi.getCandidateInfo).toHaveBeenCalled());

    act(() => socketOptions().onStateChange("complete"));

    expect(screen.getByText("Interview Complete")).toBeInTheDocument();
  });
});

describe("InterviewPage single-browser access", () => {
  function mockCandidateInfo(overrides: Partial<CandidateInfo>) {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: {
        session_id: 3,
        role_title: "Frontend Engineer",
        time_limit_min: 45,
        session_status: "pending",
        in_use_elsewhere: false,
        ...overrides,
      },
    } as Awaited<ReturnType<typeof sessionsApi.getCandidateInfo>>);
  }

  it("sends this browser's id when loading the interview", async () => {
    mockCandidateInfo({});
    const socketOptions = renderPage();

    await waitFor(() =>
      expect(sessionsApi.getCandidateInfo).toHaveBeenCalledWith(
        "invite-token",
        expect.stringMatching(/^[0-9a-f]{32}$/),
      ),
    );
    const [, clientId] = vi.mocked(sessionsApi.getCandidateInfo).mock.calls[0];
    expect(socketOptions().clientId).toBe(clientId);
  });

  it("blocks the page when another browser already started the interview", async () => {
    mockCandidateInfo({ session_status: "active", in_use_elsewhere: true });
    renderPage();

    expect(await screen.findByText("Interview Already in Progress")).toBeInTheDocument();
    expect(screen.queryByText("Interview Complete")).not.toBeInTheDocument();
  });

  it("blocks the page when another browser wins the start", async () => {
    mockCandidateInfo({});
    const socketOptions = renderPage();
    await waitFor(() => expect(sessionsApi.getCandidateInfo).toHaveBeenCalled());

    act(() => {
      socketOptions().onSessionFailed?.("session_in_use");
      socketOptions().onStateChange("complete");
    });

    expect(screen.getByText("Interview Already in Progress")).toBeInTheDocument();
    expect(screen.queryByText("Interview Could Not Continue")).not.toBeInTheDocument();
  });
});

describe("InterviewPage after the connection is lost", () => {
  function mockSession(overrides: Partial<CandidateInfo>) {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: {
        session_id: 3,
        role_title: "Frontend Engineer",
        time_limit_min: 45,
        session_status: "active",
        in_use_elsewhere: false,
        ...overrides,
      },
    } as Awaited<ReturnType<typeof sessionsApi.getCandidateInfo>>);
  }

  it("does not call an interview that ended in error complete when the link is reopened", async () => {
    mockSession({ session_status: "ended", end_reason: "error" });
    renderPage();

    expect(await screen.findByText("Interview Could Not Continue")).toBeInTheDocument();
    expect(screen.queryByText("Interview Complete")).not.toBeInTheDocument();
  });

  it("still shows completion when the link is reopened after a normal end", async () => {
    mockSession({ session_status: "ended", end_reason: "all_covered" });
    renderPage();

    expect(await screen.findByText("Interview Complete")).toBeInTheDocument();
  });

  it("continues a rejoined interview with the time the server has left", async () => {
    mockSession({ session_status: "active", remaining_seconds: 600 });
    const socketOptions = renderPage();
    await waitFor(() => expect(sessionsApi.getCandidateInfo).toHaveBeenCalled());
    await screen.findByText("Frontend Engineer");

    act(() => socketOptions().onStateChange("active"));

    expect(screen.getByText(/^(10:00|09:59)$/)).toBeInTheDocument();
    expect(screen.queryByText("45:00")).not.toBeInTheDocument();
  });

  it("gives a new interview its full time when it goes live", async () => {
    mockSession({ session_status: "pending", remaining_seconds: null });
    const socketOptions = renderPage();
    await waitFor(() => expect(sessionsApi.getCandidateInfo).toHaveBeenCalled());
    await screen.findByText("Frontend Engineer");

    act(() => socketOptions().onStateChange("active"));

    expect(screen.getByText(/^(45:00|44:59)$/)).toBeInTheDocument();
  });

  it("shows the earlier conversation after rejoining and adds new turns after it", async () => {
    mockSession({ session_status: "active", remaining_seconds: 600 });
    const socketOptions = renderPage();
    await screen.findByText("Frontend Engineer");

    act(() => {
      socketOptions().onStateChange("active");
      socketOptions().onTranscriptHistory?.([
        { speaker: "assessor", text: "Tell me about a project" },
        { speaker: "candidate", text: "I built a table" },
      ]);
      socketOptions().onTranscript({ speaker: "assessor", text: "How did you test it?" });
    });

    const shown = ["Tell me about a project", "I built a table", "How did you test it?"].map(
      (text) => screen.getByText(text),
    );
    expect(shown[0].compareDocumentPosition(shown[1])).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(shown[1].compareDocumentPosition(shown[2])).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("explains why this browser stopped when another one took over", async () => {
    mockSession({});
    const socketOptions = renderPage();
    await waitFor(() => expect(sessionsApi.getCandidateInfo).toHaveBeenCalled());

    act(() => {
      socketOptions().onSessionFailed?.("connection_replaced");
      socketOptions().onStateChange("complete");
    });

    expect(screen.getByText("Interview Continued Elsewhere")).toBeInTheDocument();
    expect(screen.queryByText("Interview Could Not Continue")).not.toBeInTheDocument();
    expect(screen.queryByText("Interview Complete")).not.toBeInTheDocument();
  });

  it("releases the microphone on the end screen", async () => {
    mockSession({});
    const socketOptions = renderPage();
    await waitFor(() => expect(sessionsApi.getCandidateInfo).toHaveBeenCalled());
    stopCapture.mockClear();

    act(() => {
      socketOptions().onSessionFailed?.();
      socketOptions().onStateChange("complete");
    });

    expect(stopCapture).toHaveBeenCalled();
  });
});

describe("InterviewPage claim service failure", () => {
  it("offers a retry instead of reporting a failed or finished interview", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: {
        session_id: 3,
        role_title: "Frontend Engineer",
        time_limit_min: 45,
        session_status: "active",
        in_use_elsewhere: false,
      },
    } as Awaited<ReturnType<typeof sessionsApi.getCandidateInfo>>);
    const socketOptions = renderPage();
    await waitFor(() => expect(sessionsApi.getCandidateInfo).toHaveBeenCalled());

    act(() => {
      socketOptions().onSessionFailed?.("claim_unavailable");
      socketOptions().onStateChange("complete");
    });

    expect(screen.getByText("Interview Service Unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText("Interview Could Not Continue")).not.toBeInTheDocument();
    expect(screen.queryByText("Interview Complete")).not.toBeInTheDocument();
  });
});

describe("InterviewPage invite link loading", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.getCandidateInfo).mockReset();
  });

  it("tells the candidate the link is invalid instead of claiming the interview is complete", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockRejectedValueOnce(httpError(404));
    renderPage();

    expect(await screen.findByText("Interview Link Not Valid")).toBeInTheDocument();
    expect(screen.queryByText("Interview Complete")).not.toBeInTheDocument();
  });

  it("lets the candidate retry after a network failure", async () => {
    vi.mocked(sessionsApi.getCandidateInfo)
      .mockRejectedValueOnce(httpError())
      .mockResolvedValueOnce({
        data: {
          session_id: 3,
          role_title: "Frontend Engineer",
          time_limit_min: 45,
          session_status: "pending",
          in_use_elsewhere: false,
        },
      } as Awaited<ReturnType<typeof sessionsApi.getCandidateInfo>>);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Couldn't Load Your Interview")).toBeInTheDocument();
    expect(screen.queryByText("Interview Complete")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Frontend Engineer")).toBeInTheDocument();
  });

  it("does not offer the hardware check until the interview has loaded", () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("Loading your interview...")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hardware checks done" })).not.toBeInTheDocument();
  });
});

describe("InterviewPage microphone start", () => {
  beforeEach(() => {
    startCapture.mockReset();
    connect.mockReset();
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: {
        session_id: 3,
        role_title: "Frontend Engineer",
        time_limit_min: 45,
        session_status: "pending",
        in_use_elsewhere: false,
      },
    } as Awaited<ReturnType<typeof sessionsApi.getCandidateInfo>>);
  });

  it("explains a microphone failure and does not start the AI session", async () => {
    startCapture.mockResolvedValue(false);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Hardware checks done" }));

    expect(await screen.findByText(/couldn't access your microphone/)).toBeInTheDocument();
    expect(connect).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Start Interview/ })).toBeInTheDocument();
  });

  it("connects once the microphone is capturing", async () => {
    startCapture.mockResolvedValue(true);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Hardware checks done" }));

    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
  });
});

describe("InterviewPage wrap-up", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: {
        session_id: 3,
        role_title: "Frontend Engineer",
        time_limit_min: 45,
        session_status: "active",
        in_use_elsewhere: false,
      },
    } as Awaited<ReturnType<typeof sessionsApi.getCandidateInfo>>);
    vi.mocked(sessionsApi.audioComplete).mockReset().mockRejectedValue(httpError(500));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops retrying audio_complete and tells the candidate when the end cannot be recorded", async () => {
    const socketOptions = renderPage();
    await waitFor(() => expect(sessionsApi.getCandidateInfo).toHaveBeenCalled());
    vi.useFakeTimers();

    act(() => socketOptions().onStateChange("draining_audio"));
    // 10s drain safety timeout, then retries 2s + 4s + 8s + 8s apart.
    await act(() => vi.advanceTimersByTimeAsync(10_000 + 2_000 + 4_000 + 8_000 + 8_000));

    expect(sessionsApi.audioComplete).toHaveBeenCalledTimes(5);
    expect(screen.getByText("Interview Could Not Continue")).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(sessionsApi.audioComplete).toHaveBeenCalledTimes(5);
  });
});

describe("InterviewPage turn-taking", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: {
        session_id: 3,
        role_title: "Frontend Engineer",
        time_limit_min: 45,
        session_status: "active",
        in_use_elsewhere: false,
      },
    } as Awaited<ReturnType<typeof sessionsApi.getCandidateInfo>>);
  });

  async function startActiveInterview() {
    const socketOptions = renderPage();
    await waitFor(() => expect(sessionsApi.getCandidateInfo).toHaveBeenCalled());
    await screen.findByText("Frontend Engineer");
    act(() => socketOptions().onStateChange("active"));
    return socketOptions;
  }

  it("shows one voice at a time, handing the turn from the AI to the candidate", async () => {
    const socketOptions = await startActiveInterview();

    act(() => socketOptions().onSpeakerChange?.("ai"));
    expect(screen.getAllByTestId("voice-orb")).toHaveLength(1);
    expect(screen.getByTestId("voice-orb")).toHaveAttribute("data-mode", "ai");
    expect(screen.getByText("AI is speaking")).toBeInTheDocument();
    expect(screen.queryByText("Your turn — go ahead")).not.toBeInTheDocument();

    act(() => socketOptions().onSpeakerChange?.("candidate"));
    expect(screen.getAllByTestId("voice-orb")).toHaveLength(1);
    expect(screen.getByTestId("voice-orb")).toHaveAttribute("data-mode", "candidate");
    expect(screen.getByText("Your turn — go ahead")).toBeInTheDocument();
    expect(screen.queryByText("AI is speaking")).not.toBeInTheDocument();
  });

  it("tells the candidate they are muted when it is their turn", async () => {
    const socketOptions = await startActiveInterview();
    act(() => socketOptions().onSpeakerChange?.("candidate"));
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Mute microphone" }));

    expect(screen.getByText("You're muted — unmute to answer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unmute microphone" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps the transcript visible under the orb", async () => {
    const socketOptions = await startActiveInterview();

    act(() => socketOptions().onTranscript?.({ speaker: "ai", text: "Tell me about a project." }));

    expect(screen.getByRole("region", { name: "Conversation" })).toBeInTheDocument();
    expect(screen.getByText("Tell me about a project.")).toBeInTheDocument();
  });
});
