import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import InterviewPage from "./InterviewPage";
import { useInterviewPage } from "./useInterviewPage";

vi.mock("./useInterviewPage", () => ({
  useInterviewPage: vi.fn(),
}));

vi.mock("@/components/interview/VoiceBars", () => ({
  default: ({
    label,
  }: {
    label: string;
    active: boolean;
    variant: string;
  }) => <div data-testid="voice-bars">{label}</div>,
}));

vi.mock("@/components/interview/InterviewTimer", () => ({
  default: ({
    totalSeconds,
    running,
    onExpired,
  }: {
    totalSeconds: number;
    running: boolean;
    onExpired: () => void;
  }) => (
    <div data-testid="interview-timer">
      {totalSeconds}-{running ? "running" : "stopped"}
      <button onClick={onExpired}>expire</button>
    </div>
  ),
}));

vi.mock("@/components/interview/ConnectionStatus", () => ({
  default: ({ state }: { state: string }) => (
    <div data-testid="connection-status">{state}</div>
  ),
}));

vi.mock("@/components/interview/TranscriptBubble", () => ({
  default: ({
    speaker,
    text,
  }: {
    speaker: string;
    text: string;
  }) => (
    <div data-testid="transcript-bubble">
      {speaker}: {text}
    </div>
  ),
}));

vi.mock("@/components/HardwareCheck", () => ({
  default: ({ onStart }: { onStart: () => void }) => (
    <button onClick={onStart}>Complete hardware check</button>
  ),
}));

const mockedUseInterviewPage = vi.mocked(useInterviewPage);

const candidateInfo = {
  role_title: "Senior Frontend Engineer",
  time_limit_min: 10,
  session_id: 1,
  session_status: "pending",
};

const createViewModel = (
  overrides: Partial<ReturnType<typeof useInterviewPage>> = {}
): ReturnType<typeof useInterviewPage> => ({
  candidateInfo,
  interviewState: "idle",
  speaker: null,
  transcript: [],
  hardwareCheckDone: false,
  connectionLostLong: false,
  reconnectedPrompt: false,
  micMuted: false,
  wsConnectionStatus: "connected",
  setHardwareCheckDone: vi.fn(),
  setReconnectedPrompt: vi.fn(),
  toggleMic: vi.fn(),
  startInterview: vi.fn(),
  endInterview: vi.fn(),
  endDetails: null,
  sendJson: vi.fn(),
  ...overrides,
});

describe("InterviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DEV", false);
  });

  it("renders pre-start state", () => {
    mockedUseInterviewPage.mockReturnValue(createViewModel());

    render(<InterviewPage />);

    expect(
      screen.getByRole("heading", {
        name: "Senior Frontend Engineer",
      })
    ).toBeInTheDocument();

    expect(screen.getByText("10 minutes")).toBeInTheDocument();

    expect(
      screen.getByText(
        /This is a voice interview\. Make sure you're in a quiet place\./
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Complete hardware check",
      })
    ).toBeInTheDocument();
  });

  it("starts interview after hardware check", () => {
    const setHardwareCheckDone = vi.fn();
    const startInterview = vi.fn();

    mockedUseInterviewPage.mockReturnValue(
      createViewModel({
        setHardwareCheckDone,
        startInterview,
      })
    );

    render(<InterviewPage />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Complete hardware check",
      })
    );

    expect(setHardwareCheckDone).toHaveBeenCalledWith(true);
    expect(startInterview).toHaveBeenCalledTimes(1);
  });

  it("renders hardware check passed state", () => {
    mockedUseInterviewPage.mockReturnValue(
      createViewModel({
        hardwareCheckDone: true,
      })
    );

    render(<InterviewPage />);

    expect(
      screen.getByText("Hardware checks passed. You're ready to start.")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /Start Interview/i,
      })
    ).toBeInTheDocument();
  });

  it("starts interview from hardware check passed state", () => {
    const startInterview = vi.fn();

    mockedUseInterviewPage.mockReturnValue(
      createViewModel({
        hardwareCheckDone: true,
        startInterview,
      })
    );

    render(<InterviewPage />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /Start Interview/i,
      })
    );

    expect(startInterview).toHaveBeenCalledTimes(1);
  });

  it("renders completed interview state", () => {
    mockedUseInterviewPage.mockReturnValue(
      createViewModel({
        interviewState: "complete",
        endDetails: {
          reason: "completed",
        },
      })
    );

    render(<InterviewPage />);

    expect(
      screen.getByRole("heading", {
        name: "Interview Complete",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Thank you. The interview has been recorded./)
    ).toBeInTheDocument();
  });

  it("renders already completed state", () => {
    mockedUseInterviewPage.mockReturnValue(
      createViewModel({
        interviewState: "complete",
        endDetails: null,
      })
    );

    render(<InterviewPage />);

    expect(
      screen.getByRole("heading", {
        name: "Interview Already Completed",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /This interview session has already been completed/
      )
    ).toBeInTheDocument();
  });

  it("renders interview error state", () => {
    mockedUseInterviewPage.mockReturnValue(
      createViewModel({
        interviewState: "complete",
        endDetails: {
          reason: "error",
          message: "Connection failed unexpectedly.",
        },
      })
    );

    render(<InterviewPage />);

    expect(
      screen.getByRole("heading", {
        name: "Interview Ended with Problem",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText("Connection failed unexpectedly.")
    ).toBeInTheDocument();
  });

  it("renders connecting state", () => {
    mockedUseInterviewPage.mockReturnValue(
      createViewModel({
        interviewState: "connecting",
      })
    );

    render(<InterviewPage />);

    expect(screen.getByText("Connecting...")).toBeInTheDocument();
  });

  it("renders AI speaking state", () => {
    mockedUseInterviewPage.mockReturnValue(
      createViewModel({
        interviewState: "active",
        speaker: "ai",
      })
    );

    render(<InterviewPage />);

    expect(screen.getByTestId("voice-bars")).toHaveTextContent(
      "AI speaking"
    );
  });

  it("renders listening state when AI is not speaking", () => {
    mockedUseInterviewPage.mockReturnValue(
      createViewModel({
        interviewState: "active",
        speaker: null,
      })
    );

    render(<InterviewPage />);

    expect(screen.getByTestId("voice-bars")).toHaveTextContent(
      "Listening..."
    );
  });

  it("renders candidate speaking state", () => {
    mockedUseInterviewPage.mockReturnValue(
      createViewModel({
        interviewState: "active",
        speaker: "candidate",
      })
    );

    render(<InterviewPage />);

    expect(screen.getByTestId("voice-bars")).toHaveTextContent(
      "You're speaking"
    );
  });

  it("renders reconnecting message", () => {
    mockedUseInterviewPage.mockReturnValue(
      createViewModel({
        interviewState: "reconnecting",
        connectionLostLong: false,
      })
    );

    render(<InterviewPage />);

    expect(
      screen.getByText(
        "Briefly reconnecting — please wait a moment."
      )
    ).toBeInTheDocument();
  });

  it("renders long reconnecting message", () => {
    mockedUseInterviewPage.mockReturnValue(
      createViewModel({
        interviewState: "reconnecting",
        connectionLostLong: true,
      })
    );

    render(<InterviewPage />);

    expect(
      screen.getByText(
        /Connection is taking too long to restore/
      )
    ).toBeInTheDocument();
  });

  it("dismisses reconnected prompt", () => {
    const setReconnectedPrompt = vi.fn();

    mockedUseInterviewPage.mockReturnValue(
      createViewModel({
        interviewState: "active",
        reconnectedPrompt: true,
        setReconnectedPrompt,
      })
    );

    render(<InterviewPage />);

    expect(
      screen.getByText(/Reconnected — please say/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "✕" }));

    expect(setReconnectedPrompt).toHaveBeenCalledWith(false);
  });

  it("toggles microphone", () => {
    const toggleMic = vi.fn();

    mockedUseInterviewPage.mockReturnValue(
      createViewModel({
        interviewState: "active",
        toggleMic,
      })
    );

    render(<InterviewPage />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /Mic On/i,
      })
    );

    expect(toggleMic).toHaveBeenCalledTimes(1);
  });

  it("renders muted microphone state", () => {
    mockedUseInterviewPage.mockReturnValue(
      createViewModel({
        interviewState: "active",
        micMuted: true,
      })
    );

    render(<InterviewPage />);

    expect(
      screen.getByRole("button", {
        name: /Muted/i,
      })
    ).toBeInTheDocument();
  });

  it("ends interview from confirmation dialog", () => {
    const endInterview = vi.fn();

    mockedUseInterviewPage.mockReturnValue(
      createViewModel({
        interviewState: "active",
        endInterview,
      })
    );

    render(<InterviewPage />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "End Interview",
      })
    );

    expect(
      screen.getByText("End interview?")
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "End interview",
      })
    );

    expect(endInterview).toHaveBeenCalledTimes(1);
  });

  it("renders transcript", () => {
    mockedUseInterviewPage.mockReturnValue(
      createViewModel({
        interviewState: "active",
        transcript: [
          {
            speaker: "ai",
            text: "Tell me about your frontend experience.",
          },
          {
            speaker: "candidate",
            text: "I have five years of experience.",
          },
        ],
      })
    );

    render(<InterviewPage />);

    expect(
      screen.getByText(
        "ai: Tell me about your frontend experience."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "candidate: I have five years of experience."
      )
    ).toBeInTheDocument();
  });

  it("renders draining audio state", () => {
    mockedUseInterviewPage.mockReturnValue(
      createViewModel({
        interviewState: "draining_audio",
      })
    );

    render(<InterviewPage />);

    expect(
      screen.getByTestId("voice-bars")
    ).toHaveTextContent("AI speaking");

    expect(screen.getByText("Wrapping up...")).toBeInTheDocument();
  });

  it("calls endInterview when timer expires", () => {
    const endInterview = vi.fn();

    mockedUseInterviewPage.mockReturnValue(
      createViewModel({
        interviewState: "active",
        endInterview,
      })
    );

    render(<InterviewPage />);

    fireEvent.click(screen.getByRole("button", { name: "expire" }));

    expect(endInterview).toHaveBeenCalledTimes(1);
  });
});