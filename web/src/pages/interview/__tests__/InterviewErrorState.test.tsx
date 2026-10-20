import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import InterviewPage from "../InterviewPage";
import { sessionsApi } from "@/services/sessions";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getCandidateInfo: vi.fn(),
    updateCandidate: vi.fn(),
    audioComplete: vi.fn().mockResolvedValue({ data: { ended: true } }),
  },
}));

vi.mock("@/hooks/useAudioCapture", () => ({
  useAudioCapture: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    mute: vi.fn(),
    unmute: vi.fn(),
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

let capturedOnStateChange: ((state: any) => void) | undefined;
const mockConnect = vi.fn();

vi.mock("@/hooks/useAudioWebSocket", () => ({
  useAudioWebSocket: (opts: any) => {
    capturedOnStateChange = opts?.onStateChange;
    return {
      connect: () => {
        mockConnect();
      },
      send: vi.fn(),
      sendJson: vi.fn(),
      disconnect: vi.fn(),
      connectionState: "disconnected",
    };
  },
}));

vi.mock("@/components/HardwareCheck", () => ({
  default: () => <div data-testid="mock-hardware-check" />,
}));

describe("InterviewPage - Error vs Complete State Differentiation (UX-01 & UX-02)", () => {
  const mockToken = "token-error-test";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Interview Complete only when session has a clean end reason", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValueOnce({
      data: {
        session_id: 101,
        candidate_name: "John Doe",
        role_title: "Fullstack Engineer",
        time_limit_min: 30,
        consent_given: true,
        session_status: "ended",
        end_reason: "manual_candidate",
      },
    } as any);

    render(
      <MemoryRouter initialEntries={[`/interview/${mockToken}`]}>
        <Routes>
          <Route path="/interview/:token" element={<InterviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Interview Complete")).toBeInTheDocument();
      expect(screen.queryByText("Connection Interrupted")).not.toBeInTheDocument();
    });
  });

  it("renders Connection Interrupted with Retry Connection button when session ended with error", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValueOnce({
      data: {
        session_id: 102,
        candidate_name: "Jane Smith",
        role_title: "Fullstack Engineer",
        time_limit_min: 30,
        consent_given: true,
        session_status: "ended",
        end_reason: "error",
      },
    } as any);

    render(
      <MemoryRouter initialEntries={[`/interview/${mockToken}`]}>
        <Routes>
          <Route path="/interview/:token" element={<InterviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Connection Interrupted")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Retry Connection/i })).toBeInTheDocument();
      expect(screen.queryByText("Interview Complete")).not.toBeInTheDocument();
    });
  });

  it("transitions to Interview Complete on first retry click if backend session is already ended", async () => {
    vi.mocked(sessionsApi.getCandidateInfo)
      .mockResolvedValueOnce({
        data: {
          session_id: 103,
          candidate_name: "Alex Lee",
          role_title: "Fullstack Engineer",
          time_limit_min: 30,
          consent_given: true,
          session_status: "ended",
          end_reason: "error",
        },
      } as any)
      .mockResolvedValueOnce({
        data: {
          session_id: 103,
          candidate_name: "Alex Lee",
          role_title: "Fullstack Engineer",
          time_limit_min: 30,
          consent_given: true,
          session_status: "ended",
          end_reason: "manual_candidate",
        },
      } as any);

    render(
      <MemoryRouter initialEntries={[`/interview/${mockToken}`]}>
        <Routes>
          <Route path="/interview/:token" element={<InterviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Connection Interrupted")).toBeInTheDocument();
    });

    const retryButton = screen.getByRole("button", { name: /Retry Connection/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText("Interview Complete")).toBeInTheDocument();
      expect(screen.queryByText("Connection Interrupted")).not.toBeInTheDocument();
    });
  });

  it("attempts reconnect on first retry click if backend session is still active", async () => {
    vi.mocked(sessionsApi.getCandidateInfo)
      .mockRejectedValueOnce(new Error("Transient Network Glitch"))
      .mockResolvedValueOnce({
        data: {
          session_id: 104,
          candidate_name: "Sarah Connors",
          role_title: "Backend Engineer",
          time_limit_min: 30,
          consent_given: true,
          session_status: "active",
        },
      } as any);

    render(
      <MemoryRouter initialEntries={[`/interview/${mockToken}`]}>
        <Routes>
          <Route path="/interview/:token" element={<InterviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Connection Interrupted")).toBeInTheDocument();
    });

    const retryButton = screen.getByRole("button", { name: /Retry Connection/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });

  it("transitions to Interview Complete on second retry click when retried again", async () => {
    vi.mocked(sessionsApi.getCandidateInfo)
      .mockRejectedValueOnce(new Error("Initial Network Failure"))
      .mockRejectedValueOnce(new Error("First Retry Network Failure"));

    render(
      <MemoryRouter initialEntries={[`/interview/${mockToken}`]}>
        <Routes>
          <Route path="/interview/:token" element={<InterviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Connection Interrupted")).toBeInTheDocument();
    });

    // First retry click
    const retryButton1 = screen.getByRole("button", { name: /Retry Connection/i });
    fireEvent.click(retryButton1);

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    // Simulate WebSocket reconnection failure that returns interviewState to error
    act(() => {
      capturedOnStateChange?.("error");
    });

    await waitFor(() => {
      expect(screen.getByText("Connection Interrupted")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Finish Interview/i })).toBeInTheDocument();
    });

    // Second retry click
    const retryButton2 = screen.getByRole("button", { name: /Retry Connection/i });
    fireEvent.click(retryButton2);

    await waitFor(() => {
      expect(screen.getByText("Interview Complete")).toBeInTheDocument();
      expect(screen.queryByText("Connection Interrupted")).not.toBeInTheDocument();
    });
  });

  it("transitions to Interview Complete when clicking Finish Interview button after a failed retry", async () => {
    vi.mocked(sessionsApi.getCandidateInfo)
      .mockRejectedValueOnce(new Error("Initial Network Failure"))
      .mockRejectedValueOnce(new Error("First Retry Network Failure"));

    render(
      <MemoryRouter initialEntries={[`/interview/${mockToken}`]}>
        <Routes>
          <Route path="/interview/:token" element={<InterviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Connection Interrupted")).toBeInTheDocument();
    });

    // First retry click
    const retryButton = screen.getByRole("button", { name: /Retry Connection/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    // Simulate WebSocket reconnection failure
    act(() => {
      capturedOnStateChange?.("error");
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Finish Interview/i })).toBeInTheDocument();
    });

    const finishButton = screen.getByRole("button", { name: /Finish Interview/i });
    fireEvent.click(finishButton);

    await waitFor(() => {
      expect(screen.getByText("Interview Complete")).toBeInTheDocument();
      expect(screen.queryByText("Connection Interrupted")).not.toBeInTheDocument();
    });
  });
});
