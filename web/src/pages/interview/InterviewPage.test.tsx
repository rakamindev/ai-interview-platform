import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import InterviewPage from "@/pages/interview/InterviewPage";

const { sessionsApi, ws } = vi.hoisted(() => ({
  sessionsApi: {
    getCandidateInfo: vi.fn(),
    getConsent: vi.fn(),
    submitConsent: vi.fn(),
    audioComplete: vi.fn(),
  },
  // Captures the options the page passes to the audio socket so a test can
  // drive the interview lifecycle (e.g. the end-of-interview drain).
  ws: { options: null as { onStateChange?: (s: string) => void } | null },
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ token: "invite-token-123" }),
}));

vi.mock("@/services/sessions", () => ({ sessionsApi }));

vi.mock("@/hooks/useAudioCapture", () => ({
  useAudioCapture: () => ({ start: vi.fn(), stop: vi.fn(), mute: vi.fn(), unmute: vi.fn() }),
}));

vi.mock("@/hooks/useAudioPlayback", () => ({
  useAudioPlayback: () => ({
    playChunk: vi.fn(),
    stop: vi.fn(),
    scheduleAfterPlayback: vi.fn(),
    // The queue is always already drained in tests: run the callback at once.
    waitForDrain: (cb: () => void) => cb(),
    cancelDrain: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAudioWebSocket", () => ({
  useAudioWebSocket: (options: { onStateChange?: (s: string) => void }) => {
    ws.options = options;
    return {
      connect: vi.fn(),
      send: vi.fn(),
      sendJson: vi.fn(),
      disconnect: vi.fn(),
      connectionState: "disconnected",
    };
  },
}));

vi.mock("@/components/HardwareCheck", () => ({
  default: () => <div data-testid="hardware-check" />,
}));

function candidateInfo(overrides: Record<string, unknown> = {}) {
  return {
    session_id: 1,
    role_title: "Backend Engineer",
    time_limit_min: 30,
    session_status: "pending",
    consent_required: true,
    consent_status: "pending",
    policy_version: "1.0",
    ...overrides,
  };
}

const policy = {
  data_collected: ["Voice recording"],
  purposes: ["Assessment"],
  retention: "For the hiring process.",
  rights: ["Access"],
  contact: "Contact the company.",
};

describe("InterviewPage consent wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the completion screen for an ended session, never the consent screen", async () => {
    sessionsApi.getCandidateInfo.mockResolvedValue({
      data: candidateInfo({ session_status: "ended", consent_status: "pending" }),
    });

    render(<InterviewPage />);

    expect(await screen.findByText("Interview Complete")).toBeInTheDocument();
    expect(screen.queryByText("Before you start")).not.toBeInTheDocument();
    expect(sessionsApi.getConsent).not.toHaveBeenCalled();
  });

  it("skips the consent screen when consent is already accepted", async () => {
    sessionsApi.getCandidateInfo.mockResolvedValue({
      data: candidateInfo({ consent_status: "accepted" }),
    });

    render(<InterviewPage />);

    await waitFor(() => {
      expect(screen.getByTestId("hardware-check")).toBeInTheDocument();
    });
    expect(screen.queryByText("Before you start")).not.toBeInTheDocument();
    expect(sessionsApi.getConsent).not.toHaveBeenCalled();
  });

  it("shows a retry screen when fetching the policy fails, and refetches on click", async () => {
    sessionsApi.getCandidateInfo.mockResolvedValue({
      data: candidateInfo(),
    });
    sessionsApi.getConsent.mockRejectedValueOnce(new Error("network"));

    render(<InterviewPage />);

    expect(await screen.findByText(/Couldn't load the data protection notice/)).toBeInTheDocument();

    sessionsApi.getConsent.mockResolvedValueOnce({ data: { policy_version: "1.0", policy, consent_status: "pending" } });
    fireEvent.click(screen.getByRole("button", { name: /Try again/i }));

    await waitFor(() => {
      expect(screen.getByText("Before you start")).toBeInTheDocument();
    });
    expect(sessionsApi.getConsent).toHaveBeenCalledTimes(2);
  });

  it("shows the consent screen when required and still pending", async () => {
    sessionsApi.getCandidateInfo.mockResolvedValue({
      data: candidateInfo(),
    });
    sessionsApi.getConsent.mockResolvedValue({
      data: { policy_version: "1.0", policy, consent_status: "pending" },
    });

    render(<InterviewPage />);

    expect(await screen.findByText("Before you start")).toBeInTheDocument();
    expect(screen.getByText("Voice recording")).toBeInTheDocument();
  });
});

describe("InterviewPage end-of-interview completion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ws.options = null;
    sessionsApi.getCandidateInfo.mockResolvedValue({
      data: candidateInfo({ session_status: "active", consent_status: "accepted" }),
    });
  });

  // Drives the page to the point where it asks the API to close the session.
  async function drainAudio() {
    render(<InterviewPage />);
    await waitFor(() => expect(ws.options).not.toBeNull());
    await act(async () => {
      ws.options!.onStateChange?.("draining_audio");
    });
  }

  it("stops retrying when the server refuses to end the session (4xx)", async () => {
    sessionsApi.audioComplete.mockRejectedValue({ response: { status: 422 } });

    await drainAudio();

    // A refusal is a decision, not a hiccup: retrying it forever would leave the
    // candidate on a dead screen while the session never closes.
    await waitFor(() => expect(sessionsApi.audioComplete).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Interview Finished")).toBeInTheDocument();
    expect(screen.getByText(/hiring team will finalise it/i)).toBeInTheDocument();
  });

  it("retries a transient server error and completes normally once it succeeds", async () => {
    vi.useFakeTimers();
    sessionsApi.audioComplete
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValueOnce({ data: { ended: true } });

    try {
      render(<InterviewPage />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      await act(async () => {
        ws.options!.onStateChange?.("draining_audio");
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });

      expect(sessionsApi.audioComplete).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("Interview Finished")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
