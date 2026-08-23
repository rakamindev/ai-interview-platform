import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import InterviewPage from "./InterviewPage";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getCandidateInfo: vi.fn(),
    audioComplete: vi.fn()
  }
}));

vi.mock("@/hooks/useAudioCapture", () => ({
  useAudioCapture: vi.fn(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    mute: vi.fn(),
    unmute: vi.fn(),
    isSending: false,
    analyserRef: { current: null }
  }))
}));

vi.mock("@/hooks/useAudioPlayback", () => ({
  useAudioPlayback: vi.fn(() => ({
    playChunk: vi.fn(),
    stop: vi.fn(),
    scheduleAfterPlayback: vi.fn((cb: () => void) => cb()),
    waitForDrain: vi.fn(),
    cancelDrain: vi.fn(),
    analyserRef: { current: null }
  }))
}));

vi.mock("@/hooks/useAudioWebSocket", () => ({
  useAudioWebSocket: vi.fn(() => ({
    connect: vi.fn(),
    send: vi.fn(),
    sendJson: vi.fn(),
    disconnect: vi.fn(),
    connectionState: "disconnected"
  }))
}));

vi.mock("@/components/HardwareCheck", () => ({
  default: ({ onStart }: { onStart: () => void }) => (
    <div data-testid="hardware-check">
      <button onClick={onStart}>Start</button>
    </div>
  )
}));

vi.mock("@/components/interview/VoiceBars", () => ({
  default: () => <div data-testid="voice-bars" />
}));

vi.mock("@/components/interview/InterviewTimer", () => ({
  default: () => <div data-testid="interview-timer" />
}));

vi.mock("@/components/interview/ConnectionStatus", () => ({
  default: ({ state }: { state: string }) => <div data-testid="connection-status">{state}</div>
}));

vi.mock("@/components/interview/TranscriptBubble", () => ({
  default: ({ text }: { text: string }) => <div data-testid="transcript-bubble">{text}</div>
}));

import { sessionsApi } from "@/services/sessions";

const mockSessionsApi = vi.mocked(sessionsApi);

function renderPage(token = "test-token") {
  return render(
    <MemoryRouter initialEntries={[`/interview/${token}`]}>
      <Routes>
        <Route path="/interview/:token" element={<InterviewPage />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("InterviewPage", () => {
  it("renders hardware check when idle", async () => {
    mockSessionsApi.getCandidateInfo.mockResolvedValue({
      data: {
        session_id: 1,
        role_title: "Frontend Developer",
        time_limit_min: 30,
        session_status: "pending"
      }
    } as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Frontend Developer")).toBeInTheDocument();
    });
    expect(screen.getByTestId("hardware-check")).toBeInTheDocument();
    expect(screen.getByText("30 minutes")).toBeInTheDocument();
  });

  it("shows interview tips before hardware check", async () => {
    mockSessionsApi.getCandidateInfo.mockResolvedValue({
      data: {
        session_id: 1,
        role_title: "Backend Developer",
        time_limit_min: 20,
        session_status: "pending"
      }
    } as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Backend Developer")).toBeInTheDocument();
    });
    expect(screen.getByText(/Speak clearly and naturally/)).toBeInTheDocument();
    expect(screen.getByText(/There are no wrong answers/)).toBeInTheDocument();
  });

  it("shows connection status when connected", async () => {
    mockSessionsApi.getCandidateInfo.mockResolvedValue({
      data: {
        session_id: 1,
        role_title: "AI Interview",
        time_limit_min: 15,
        session_status: "active"
      }
    } as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("hardware-check")).toBeInTheDocument();
    });
  });

  it("shows complete state for ended session", async () => {
    mockSessionsApi.getCandidateInfo.mockResolvedValue({
      data: {
        session_id: 1,
        role_title: "AI Interview",
        time_limit_min: 30,
        session_status: "ended"
      }
    } as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Interview Complete")).toBeInTheDocument();
    });
    expect(screen.getByText(/Thank you\. The interview has been recorded/)).toBeInTheDocument();
  });

  it("shows invalid invite screen for invite_invalid error", async () => {
    mockSessionsApi.getCandidateInfo.mockRejectedValue({
      response: { data: { errors: [{ code: "invite_invalid" }] } }
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Invalid Interview Link")).toBeInTheDocument();
    });
    expect(screen.getByText(/invalid or malformed/)).toBeInTheDocument();
    expect(screen.queryByText("Interview Complete")).not.toBeInTheDocument();
  });

  it("shows expired invite screen for invite_expired error", async () => {
    mockSessionsApi.getCandidateInfo.mockRejectedValue({
      response: { data: { errors: [{ code: "invite_expired" }] } }
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Interview Link Expired")).toBeInTheDocument();
    });
    expect(screen.getByText(/has expired/)).toBeInTheDocument();
    expect(screen.queryByText("Interview Complete")).not.toBeInTheDocument();
  });

  it("shows unavailable screen for assessment_not_found error", async () => {
    mockSessionsApi.getCandidateInfo.mockRejectedValue({
      response: { data: { errors: [{ code: "assessment_not_found" }] } }
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Interview Unavailable")).toBeInTheDocument();
    });
    expect(screen.getByText(/couldn't load your interview/)).toBeInTheDocument();
    expect(screen.queryByText("Interview Complete")).not.toBeInTheDocument();
  });

  it("shows connection error screen for network failure", async () => {
    mockSessionsApi.getCandidateInfo.mockRejectedValue({ request: {} });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Connection Error")).toBeInTheDocument();
    });
    expect(screen.getByText(/Unable to reach the server/)).toBeInTheDocument();
    expect(screen.queryByText("Interview Complete")).not.toBeInTheDocument();
  });

  it("does not show retry button for invite_invalid", async () => {
    mockSessionsApi.getCandidateInfo.mockRejectedValue({
      response: { data: { errors: [{ code: "invite_invalid" }] } }
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Invalid Interview Link")).toBeInTheDocument();
    });
    expect(screen.queryByText("Retry")).not.toBeInTheDocument();
  });

  it("shows retry button for invite_error", async () => {
    mockSessionsApi.getCandidateInfo.mockRejectedValue({
      response: { data: { errors: [{ code: "assessment_not_found" }] } }
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Interview Unavailable")).toBeInTheDocument();
    });
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("shows retry button for network_error", async () => {
    mockSessionsApi.getCandidateInfo.mockRejectedValue({ request: {} });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Connection Error")).toBeInTheDocument();
    });
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });
});
