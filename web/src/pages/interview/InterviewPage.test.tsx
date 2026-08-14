import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import InterviewPage from "@/pages/interview/InterviewPage";

const { sessionsApi } = vi.hoisted(() => ({
  sessionsApi: {
    getCandidateInfo: vi.fn(),
    getConsent: vi.fn(),
    submitConsent: vi.fn(),
    audioComplete: vi.fn(),
  },
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
    waitForDrain: vi.fn(),
    cancelDrain: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAudioWebSocket", () => ({
  useAudioWebSocket: () => ({
    connect: vi.fn(),
    send: vi.fn(),
    sendJson: vi.fn(),
    disconnect: vi.fn(),
    connectionState: "disconnected",
  }),
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
