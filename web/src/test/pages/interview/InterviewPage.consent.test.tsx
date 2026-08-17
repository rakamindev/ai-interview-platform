import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import InterviewPage from "@/pages/interview/InterviewPage";
import { sessionsApi } from "@/services/sessions";
import type { CandidateInfo } from "@/types";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getCandidateInfo: vi.fn(),
    submitConsent: vi.fn(),
    audioComplete: vi.fn(),
  },
}));

vi.mock("@/components/HardwareCheck", () => ({
  default: ({ onStart }: { onStart: () => void }) => (
    <button onClick={onStart}>Mock Start Interview</button>
  ),
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

const getCandidateInfoMock = vi.mocked(sessionsApi.getCandidateInfo);
const submitConsentMock = vi.mocked(sessionsApi.submitConsent);

function candidateInfo(overrides: Partial<CandidateInfo> = {}): CandidateInfo {
  return {
    session_id: 1,
    role_title: "Backend Engineer",
    time_limit_min: 30,
    session_status: "pending",
    consent_given: false,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/interview/abc123"]}>
      <Routes>
        <Route path="/interview/:token" element={<InterviewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("InterviewPage consent gate", () => {
  it("shows the consent dialog and hides hardware check when consent has not been given", async () => {
    getCandidateInfoMock.mockResolvedValue({ data: candidateInfo({ consent_given: false }) } as any);

    renderPage();

    expect(await screen.findByText("Before we start: how your data is used")).toBeInTheDocument();
    expect(screen.queryByText("Mock Start Interview")).not.toBeInTheDocument();
  });

  it("records consent and reveals the hardware check flow once accepted", async () => {
    getCandidateInfoMock.mockResolvedValue({ data: candidateInfo({ consent_given: false }) } as any);
    submitConsentMock.mockResolvedValue({ data: { consent_given: true } } as any);

    renderPage();
    await screen.findByText("Before we start: how your data is used");

    fireEvent.click(screen.getByRole("button", { name: "I consent, continue" }));

    await waitFor(() => expect(submitConsentMock).toHaveBeenCalledWith("abc123", true));
    expect(await screen.findByText("Mock Start Interview")).toBeInTheDocument();
  });

  it("blocks the interview with a consent-required screen when declined", async () => {
    getCandidateInfoMock.mockResolvedValue({ data: candidateInfo({ consent_given: false }) } as any);
    submitConsentMock.mockResolvedValue({ data: { consent_given: false } } as any);

    renderPage();
    await screen.findByText("Before we start: how your data is used");

    fireEvent.click(screen.getByRole("button", { name: "Decline" }));

    await waitFor(() => expect(submitConsentMock).toHaveBeenCalledWith("abc123", false));
    expect(await screen.findByText("Consent required")).toBeInTheDocument();
    expect(screen.queryByText("Mock Start Interview")).not.toBeInTheDocument();
  });

  it("skips the dialog entirely when the backend already has consent on record", async () => {
    getCandidateInfoMock.mockResolvedValue({ data: candidateInfo({ consent_given: true }) } as any);

    renderPage();

    expect(await screen.findByText("Mock Start Interview")).toBeInTheDocument();
    expect(screen.queryByText("Before we start: how your data is used")).not.toBeInTheDocument();
  });
});
