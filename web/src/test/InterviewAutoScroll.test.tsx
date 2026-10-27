import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import InterviewPage from "../pages/interview/InterviewPage";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Mock API
vi.mock("@/services/sessions", () => ({
  sessionsApi: {
    getCandidateInfo: vi.fn().mockResolvedValue({
      data: {
        session_id: 123,
        role_title: "Senior AI Architect",
        time_limit_min: 30,
        session_status: "in_progress",
      },
    }),
    audioComplete: vi.fn().mockResolvedValue({}),
  },
}));

// Mock HardwareCheck
vi.mock("@/components/HardwareCheck", () => ({
  default: ({ onStart }: { onStart: () => void }) => (
    <button onClick={onStart}>Mock Start Interview</button>
  ),
}));

// Mock AudioCapture
vi.mock("@/hooks/useAudioCapture", () => ({
  useAudioCapture: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    mute: vi.fn(),
    unmute: vi.fn(),
  }),
}));

// Mock AudioPlayback
vi.mock("@/hooks/useAudioPlayback", () => ({
  useAudioPlayback: () => ({
    playChunk: vi.fn(),
    stop: vi.fn(),
    scheduleAfterPlayback: vi.fn((cb) => cb()),
    waitForDrain: vi.fn(),
    cancelDrain: vi.fn(),
  }),
}));

// We'll capture onTranscript and onStateChange to simulate AI turns
let capturedOnTranscript: ((turn: { speaker: "ai" | "candidate"; text: string }) => void) | null = null;
let capturedOnStateChange: ((state: string) => void) | null = null;

vi.mock("@/hooks/useAudioWebSocket", () => ({
  useAudioWebSocket: ({ onTranscript, onStateChange }: any) => {
    capturedOnTranscript = onTranscript;
    capturedOnStateChange = onStateChange;
    return {
      connect: vi.fn(),
      send: vi.fn(),
      sendJson: vi.fn(),
      disconnect: vi.fn(),
      connectionState: "connected",
    };
  },
}));

describe("InterviewPage Auto-scroll on AI Responses", () => {
  beforeEach(() => {
    capturedOnTranscript = null;
    capturedOnStateChange = null;
    vi.clearAllMocks();
  });

  it("automatically scrolls to latest message when AI speaks/responds", async () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    window.Element.prototype.scrollIntoView = scrollIntoViewMock;

    render(
      <MemoryRouter initialEntries={["/interview/test-token"]}>
        <Routes>
          <Route path="/interview/:token" element={<InterviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Initial state: consent modal is open
    const headingElements = await screen.findAllByText(/Senior AI Architect/i);
    expect(headingElements.length).toBeGreaterThanOrEqual(1);

    // Accept consent
    const consentCheckbox = screen.getByRole("checkbox");
    act(() => {
      consentCheckbox.click();
    });

    const continueBtn = screen.getByRole("button", {
      name: /Lanjutkan ke Pengecekan Perangkat/i,
    });
    act(() => {
      continueBtn.click();
    });

    // Start hardware check / interview
    const startInterviewBtn = await screen.findByRole("button", {
      name: /Mock Start Interview/i,
    });
    act(() => {
      startInterviewBtn.click();
    });

    // Simulate interview active state
    act(() => {
      capturedOnStateChange?.("active");
    });

    // Simulate incoming AI greeting message
    act(() => {
      capturedOnTranscript?.({
        speaker: "ai",
        text: "Halo, selamat datang di sesi interview teknis Rakamin. Bisakah jelaskan arsitektur microservices Anda?",
      });
    });

    // Verify AI response bubble rendered
    expect(
      await screen.findByText(/Halo, selamat datang di sesi interview teknis Rakamin/i)
    ).toBeInTheDocument();

    // Expect scrollIntoView to have been called for auto-scrolling
    expect(scrollIntoViewMock).toHaveBeenCalled();

    // Simulate candidate answer
    act(() => {
      capturedOnTranscript?.({
        speaker: "candidate",
        text: "Tentu, saya menggunakan event-driven architecture dengan Apache Kafka dan gRPC.",
      });
    });

    expect(
      await screen.findByText(/event-driven architecture dengan Apache Kafka/i)
    ).toBeInTheDocument();

    // Simulate subsequent AI follow-up response
    act(() => {
      capturedOnTranscript?.({
        speaker: "ai",
        text: "Bagaimana Anda menangani schema evolution dan backward compatibility di Kafka?",
      });
    });

    expect(
      await screen.findByText(/schema evolution dan backward compatibility/i)
    ).toBeInTheDocument();

    // Ensure scroll was invoked for the AI follow-up
    expect(scrollIntoViewMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
