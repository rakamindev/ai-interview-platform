import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import InterviewPage from "@/pages/interview/InterviewPage";
import { sessionsApi } from "@/services/sessions";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getCandidateInfo: vi.fn(),
    grantConsent: vi.fn(),
  },
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
    scheduleAfterPlayback: vi.fn(),
    waitForDrain: vi.fn(),
    cancelDrain: vi.fn(),
  }),
}));

// Keep this test focused on the consent gate: HardwareCheck has its own spec.
vi.mock("@/components/HardwareCheck", () => ({
  default: () => <div data-testid="hardware-check">Hardware checks</div>,
}));

const getCandidateInfoMock = vi.mocked(sessionsApi.getCandidateInfo);
const grantConsentMock = vi.mocked(sessionsApi.grantConsent);

function makeCandidateInfo(
  overrides: Partial<{ consent_required: boolean; has_consent: boolean }> = {}
) {
  return {
    data: {
      session_id: 1,
      role_title: "Frontend Engineer",
      time_limit_min: 45,
      session_status: "pending",
      consent_required: true,
      consent_version: "2026-08-17",
      has_consent: false,
      ...overrides,
    },
  } as never;
}

function renderInterviewPage() {
  return render(
    <MemoryRouter initialEntries={["/interview/tk"]}>
      <Routes>
        <Route path="/interview/:token" element={<InterviewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("InterviewPage consent gate (AC-F1 / AC-T1a)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks the hardware check until consent is granted", async () => {
    const user = userEvent.setup();
    getCandidateInfoMock.mockResolvedValue(makeCandidateInfo());
    grantConsentMock.mockResolvedValue({
      data: { status: "granted" },
    } as never);

    renderInterviewPage();

    // Without consent the disclosure is shown and nothing interview-related is
    // reachable. Removing this gate (AC-T1a fault) makes this assertion fail.
    expect(
      await screen.findByRole("heading", { name: /before you start/i })
    ).toBeInTheDocument();
    expect(screen.queryByTestId("hardware-check")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /start interview/i })
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /i agree & continue/i })
    );

    await waitFor(() =>
      expect(grantConsentMock).toHaveBeenCalledWith("tk", "2026-08-17")
    );
    expect(await screen.findByTestId("hardware-check")).toBeInTheDocument();
  });

  it("shows the hardware check directly when consent is already granted", async () => {
    getCandidateInfoMock.mockResolvedValue(
      makeCandidateInfo({ has_consent: true })
    );

    renderInterviewPage();

    expect(await screen.findByTestId("hardware-check")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /before you start/i })
    ).not.toBeInTheDocument();
  });

  it("skips consent when the assessment does not require it", async () => {
    getCandidateInfoMock.mockResolvedValue(
      makeCandidateInfo({ consent_required: false })
    );

    renderInterviewPage();

    expect(await screen.findByTestId("hardware-check")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /before you start/i })
    ).not.toBeInTheDocument();
  });
});
