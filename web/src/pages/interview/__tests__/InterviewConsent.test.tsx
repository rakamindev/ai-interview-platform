import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import InterviewPage from "../InterviewPage";
import { sessionsApi } from "@/services/sessions";

vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getCandidateInfo: vi.fn(),
    updateCandidate: vi.fn(),
    audioComplete: vi.fn(),
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
  default: ({ onStart, consentAgreed }: { onStart?: () => void; consentAgreed?: boolean }) => (
    <div data-testid="mock-hardware-check">
      <button data-testid="hardware-start-btn" disabled={!consentAgreed} onClick={onStart}>
        Start Interview Mock
      </button>
    </div>
  ),
}));

describe("InterviewPage - PDP Consent Gate & Candidate Identity", () => {
  const mockToken = "valid-token-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders candidate greeting and allows name correction", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValueOnce({
      data: {
        session_id: 42,
        role_title: "Product Engineer",
        time_limit_min: 30,
        session_status: "in_progress",
        candidate_name: "Budi Santoso",
        consent_given: false,
      },
    } as any);

    vi.mocked(sessionsApi.updateCandidate).mockResolvedValueOnce({
      data: { success: true, candidate_name: "Budi Setiawan" },
    } as any);

    render(
      <MemoryRouter initialEntries={[`/interview/${mockToken}`]}>
        <Routes>
          <Route path="/interview/:token" element={<InterviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Budi Santoso/i)).toBeInTheDocument();

    const editBtn = screen.getByRole("button", { name: /koreksi nama/i });
    fireEvent.click(editBtn);

    const input = screen.getByPlaceholderText(/masukkan nama lengkap/i);
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "Budi Setiawan" } });

    const saveBtn = screen.getByRole("button", { name: /simpan/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(sessionsApi.updateCandidate).toHaveBeenCalledWith(mockToken, {
        candidate_name: "Budi Setiawan",
      });
      expect(screen.getByText(/Budi Setiawan/i)).toBeInTheDocument();
    });
  });

  it("enforces PDP consent gate before enabling start button", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValueOnce({
      data: {
        session_id: 42,
        role_title: "Product Engineer",
        time_limit_min: 30,
        session_status: "in_progress",
        candidate_name: "Siti Rahma",
        consent_given: false,
      },
    } as any);

    vi.mocked(sessionsApi.updateCandidate).mockResolvedValueOnce({
      data: { success: true, consent_given: true },
    } as any);

    render(
      <MemoryRouter initialEntries={[`/interview/${mockToken}`]}>
        <Routes>
          <Route path="/interview/:token" element={<InterviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText(/Siti Rahma/i);

    const consentCheckbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(consentCheckbox.checked).toBe(false);

    const startBtn = screen.getByTestId("hardware-start-btn");
    expect(startBtn).toBeDisabled();

    fireEvent.click(consentCheckbox);

    await waitFor(() => {
      expect(consentCheckbox.checked).toBe(true);
      expect(startBtn).not.toBeDisabled();
      expect(sessionsApi.updateCandidate).toHaveBeenCalledWith(mockToken, {
        consent_given: true,
      });
    });
  });
});
