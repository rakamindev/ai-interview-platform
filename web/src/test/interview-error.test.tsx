import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import InterviewPage from "@/pages/interview/InterviewPage";
import { sessionsApi } from "@/services/sessions";

const stopCapture = vi.fn();
const stopPlayback = vi.fn();

vi.mock("@/services/sessions", () => ({
  sessionsApi: { getCandidateInfo: vi.fn(), audioComplete: vi.fn() },
}));
vi.mock("@/components/HardwareCheck", () => ({
  default: ({ onStart }: { onStart: () => void }) => <button onClick={onStart}>Pass checks</button>,
}));
vi.mock("@/hooks/useAudioCapture", () => ({
  useAudioCapture: () => ({
    start: vi.fn().mockResolvedValue(undefined), stop: stopCapture,
    mute: vi.fn(), unmute: vi.fn(),
  }),
}));
vi.mock("@/hooks/useAudioPlayback", () => ({
  useAudioPlayback: () => ({
    playChunk: vi.fn(), stop: stopPlayback, scheduleAfterPlayback: vi.fn(),
    waitForDrain: vi.fn(), cancelDrain: vi.fn(),
  }),
}));
vi.mock("@/hooks/useAudioWebSocket", () => ({
  useAudioWebSocket: (options: {
    onError: (message: string) => void;
    onStateChange: (state: string) => void;
  }) => ({
    connect: () => {
      options.onError("The interview service is temporarily unavailable. Please contact the interviewer.");
      options.onStateChange("error");
    },
    send: vi.fn(), sendJson: vi.fn(), disconnect: vi.fn(), connectionState: "disconnected",
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
    data: { session_id: 7, role_title: "Engineer", time_limit_min: 10, session_status: "pending" },
  } as never);
});

it("shows the real startup failure instead of a false interview-complete screen", async () => {
  render(
    <MemoryRouter initialEntries={["/interview/invite-token"]}>
      <Routes>
        <Route path="/interview/:token" element={<InterviewPage />} />
      </Routes>
    </MemoryRouter>,
  );

  await waitFor(() => expect(sessionsApi.getCandidateInfo).toHaveBeenCalled());
  fireEvent.click(screen.getByText("Pass checks"));

  expect(await screen.findByText("Interview unavailable")).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain("temporarily unavailable");
  expect(screen.queryByText("Interview Complete")).toBeNull();
  expect(stopCapture).toHaveBeenCalled();
  expect(stopPlayback).toHaveBeenCalled();
});

it("does not show completion when the invitation lookup fails", async () => {
  vi.mocked(sessionsApi.getCandidateInfo).mockRejectedValue(new Error("offline"));
  render(<MemoryRouter initialEntries={["/interview/invite-token"]}><Routes>
    <Route path="/interview/:token" element={<InterviewPage />} />
  </Routes></MemoryRouter>);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText("Interview Complete")).toBeNull();
});

it("keeps an interrupted session visibly interrupted after page refresh", async () => {
  vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({ data: {
    session_id: 7, role_title: "Engineer", time_limit_min: 10,
    session_status: "ended", end_reason: "error",
  } } as never);
  render(<MemoryRouter initialEntries={["/interview/invite-token"]}><Routes>
    <Route path="/interview/:token" element={<InterviewPage />} />
  </Routes></MemoryRouter>);
  expect((await screen.findByRole("alert")).textContent).toContain("interrupted");
  expect(screen.queryByText("Interview Complete")).toBeNull();
  expect((screen.getByRole("button", { name: /Try again/ }) as HTMLButtonElement).disabled).toBe(true);
});
