import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import InterviewPage from "../InterviewPage";
import { sessionsApi } from "@/services/sessions";

// Mock react-router-dom useParams
vi.mock("react-router-dom", () => ({
  useParams: () => ({ token: "token-abc-123" }),
}));

// Mock sessionsApi
vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getCandidateInfo: vi.fn(),
    audioComplete: vi.fn(),
    endSession: vi.fn(),
  },
}));

// Mock audio hooks
vi.mock("@/hooks/useAudioCapture", () => ({
  useAudioCapture: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    mute: vi.fn(),
    unmute: vi.fn(),
    isCapturing: false,
  }),
}));

vi.mock("@/hooks/useAudioPlayback", () => ({
  useAudioPlayback: () => ({
    playChunk: vi.fn(),
    stop: vi.fn(),
    scheduleAfterPlayback: vi.fn((cb: () => void) => cb()),
    waitForDrain: vi.fn((cb: () => void) => cb()),
    cancelDrain: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAudioWebSocket", () => ({
  useAudioWebSocket: () => ({
    connect: vi.fn(),
    send: vi.fn(),
    sendJson: vi.fn(),
    disconnect: vi.fn(),
    connectionState: "connected",
  }),
}));

// Mock HardwareCheck to keep tests lightweight
vi.mock("@/components/HardwareCheck", () => ({
  default: ({ onStart }: { onStart?: () => void }) => (
    <div data-testid="mock-hardware-check">
      <button onClick={onStart}>Mock Start</button>
    </div>
  ),
}));

describe("InterviewPage Edge State & Incident Recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders IncidentCard and NEVER renders 'Interview Complete' when session ended with error", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: {
        session_id: 42,
        role_title: "Senior Backend Engineer",
        time_limit_min: 30,
        session_status: "ended",
        end_reason: "error",
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: {} as unknown as import("axios").AxiosRequestHeaders },
    });

    render(<InterviewPage />);

    // Should display incident recovery state
    await waitFor(() => {
      expect(screen.getByTestId("incident-card")).toBeInTheDocument();
      expect(screen.getByText("Sesi Wawancara Terputus")).toBeInTheDocument();
    });

    // Reference ID should be visible
    expect(screen.getByTestId("session-reference-text")).toHaveTextContent("token-abc-123");

    // The false-positive "Interview Complete" green checkmark must NOT appear
    expect(screen.queryByText("Interview Complete")).not.toBeInTheDocument();
    expect(screen.queryByTestId("completion-card")).not.toBeInTheDocument();
  });

  it("renders CompletionCard when session ended normally (manual_candidate / time_expired)", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: {
        session_id: 42,
        role_title: "Senior Backend Engineer",
        time_limit_min: 30,
        session_status: "ended",
        end_reason: "manual_candidate",
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: {} as unknown as import("axios").AxiosRequestHeaders },
    });

    render(<InterviewPage />);

    await waitFor(() => {
      expect(screen.getByTestId("completion-card")).toBeInTheDocument();
      expect(screen.getByText("Interview Complete")).toBeInTheDocument();
    });

    // Incident card must NOT appear
    expect(screen.queryByTestId("incident-card")).not.toBeInTheDocument();
    expect(screen.queryByText("Sesi Wawancara Terputus")).not.toBeInTheDocument();
  });

  it("renders HardwareCheck in 2-column layout when session is idle and not started", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: {
        session_id: 42,
        role_title: "Senior Backend Engineer",
        time_limit_min: 30,
        session_status: "active",
        end_reason: null,
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: {} as unknown as import("axios").AxiosRequestHeaders },
    });

    render(<InterviewPage />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-hardware-check")).toBeInTheDocument();
      expect(screen.getByText("Panduan & Ketentuan Sesi")).toBeInTheDocument();
    });
  });

  it("calls REST endSession fallback when session is ended", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: {
        session_id: 42,
        role_title: "Senior Backend Engineer",
        time_limit_min: 30,
        session_status: "ended",
        end_reason: "time_ceiling",
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: {} as unknown as import("axios").AxiosRequestHeaders },
    });

    render(<InterviewPage />);

    await waitFor(() => {
      expect(screen.getByTestId("completion-card")).toBeInTheDocument();
      expect(screen.queryByTestId("incident-card")).not.toBeInTheDocument();
    });
  });
});
