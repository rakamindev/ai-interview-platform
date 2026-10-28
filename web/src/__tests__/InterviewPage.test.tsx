import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import InterviewPage from "../pages/interview/InterviewPage";
import { sessionsApi } from "@/services/sessions";

// Mock react-router-dom useParams
vi.mock("react-router-dom", () => ({
  useParams: () => ({ token: "mock-token-xyz" }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

// Mock audio and websocket hooks
vi.mock("@/hooks/useAudioCapture", () => ({
  useAudioCapture: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    mute: vi.fn(),
    unmute: vi.fn(),
    isMuted: false,
  }),
}));

vi.mock("@/hooks/useAudioPlayback", () => ({
  useAudioPlayback: () => ({
    playChunk: vi.fn(),
    stop: vi.fn(),
    scheduleAfterPlayback: vi.fn(),
    waitForDrain: vi.fn((cb: () => void) => cb()),
    cancelDrain: vi.fn(),
  }),
}));

vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: () => ({
    connectionState: "connected",
    sendJson: vi.fn(),
    sendAudio: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

// Mock sessionsApi
vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getCandidateInfo: vi.fn(),
    recordConsent: vi.fn(),
    audioComplete: vi.fn(),
  },
}));

describe("InterviewPage Candidate Onboarding Resilience & Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does NOT show 'Interview Complete' when candidate fetch fails with 404 (GAP-02)", async () => {
    const error404 = {
      response: {
        status: 404,
        data: { error: "Invalid or expired invite token" },
      },
    };
    vi.mocked(sessionsApi.getCandidateInfo).mockRejectedValueOnce(error404);

    render(<InterviewPage />);

    // Must show clear error state
    await waitFor(() => {
      expect(screen.queryByText(/Interview Complete/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Link Wawancara Tidak Ditemukan/i)).toBeInTheDocument();
    });
  });

  it("shows network error with retry button when API is unreachable", async () => {
    const networkError = new Error("Network Error");
    vi.mocked(sessionsApi.getCandidateInfo).mockRejectedValueOnce(networkError);

    render(<InterviewPage />);

    await waitFor(() => {
      expect(screen.queryByText(/Interview Complete/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Gagal Terhubung ke Server/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Coba Lagi/i })).toBeInTheDocument();
    });

    // When clicking retry and API recovers
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValueOnce({
      data: {
        session_id: 101,
        role_title: "Fullstack Engineer",
        time_limit_min: 45,
        session_status: "pending",
        has_consented: false,
      },
    } as any);

    fireEvent.click(screen.getByRole("button", { name: /Coba Lagi/i }));

    await waitFor(() => {
      expect(screen.getByText("Fullstack Engineer")).toBeInTheDocument();
    });
  });

  it("ONLY shows 'Interview Complete' when session_status is genuinely 'ended' from backend", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValueOnce({
      data: {
        session_id: 101,
        role_title: "Fullstack Engineer",
        time_limit_min: 45,
        session_status: "ended",
        has_consented: true,
      },
    } as any);

    render(<InterviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/Interview Complete/i)).toBeInTheDocument();
      expect(screen.getByText(/Thank you. The interview has been recorded/i)).toBeInTheDocument();
    });
  });

  it("requires explicit consent before allowing candidate to proceed to hardware check (GAP-03)", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValueOnce({
      data: {
        session_id: 101,
        role_title: "Fullstack Engineer",
        time_limit_min: 45,
        session_status: "pending",
        has_consented: false,
      },
    } as any);

    render(<InterviewPage />);

    // Consent notice should appear
    await waitFor(() => {
      expect(screen.getByText(/Persetujuan Pemrosesan Data Pribadi/i)).toBeInTheDocument();
    });

    const proceedButton = screen.getByRole("button", { name: /Lanjutkan ke Pemeriksaan Perangkat/i });
    expect(proceedButton).toBeDisabled();

    // Check consent checkbox
    const checkbox = screen.getByRole("checkbox", { name: /persetujuan-suara-ai/i });
    fireEvent.click(checkbox);

    expect(proceedButton).not.toBeDisabled();
  });
});
