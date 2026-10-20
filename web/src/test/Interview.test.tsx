import { render, screen, act, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { sessionsApi } from "@/services/sessions";
import InterviewPage from "@/pages/interview/InterviewPage";

let wsOpts: any;

const stable = vi.hoisted(() => ({
  connect: () => {},
  send: () => {},
  sendJson: () => {},
  disconnect: () => {},
  start: async () => {},
  stop: () => {},
  mute: () => {},
  unmute: () => {},
  playChunk: () => {},
  scheduleAfterPlayback: () => {},
  waitForDrain: () => {},
  cancelDrain: () => {},
}));

vi.mock("@/hooks/useAudioWebSocket", () => ({
  useAudioWebSocket: (opts: any) => {
    wsOpts = opts;
    return {
      connect: stable.connect,
      send: stable.send,
      sendJson: stable.sendJson,
      disconnect: stable.disconnect,
      connectionState: "disconnected",
    };
  },
}));
vi.mock("@/hooks/useAudioCapture", () => ({
  useAudioCapture: () => ({
    start: stable.start,
    stop: stable.stop,
    mute: stable.mute,
    unmute: stable.unmute,
  }),
}));
vi.mock("@/hooks/useAudioPlayback", () => ({
  useAudioPlayback: () => ({
    playChunk: stable.playChunk,
    stop: stable.stop,
    scheduleAfterPlayback: stable.scheduleAfterPlayback,
    waitForDrain: stable.waitForDrain,
    cancelDrain: stable.cancelDrain,
  }),
}));
vi.mock("@/services/sessions", () => ({
  sessionsApi: { getCandidateInfo: vi.fn(), audioComplete: vi.fn() },
}));
vi.mock("@/components/HardwareCheck", () => ({ default: () => null }));

const candidate = {
  data: {
    session_id: 1,
    session_status: "pending",
    role_title: "Dev",
    time_limit_min: 10,
  },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/interview/tok"]}>
      <Routes>
        <Route path="/interview/:token" element={<InterviewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("InterviewPage error handling", () => {
  it("fetch candidate info fails -> error screen, not Interview Complete", async () => {
    (sessionsApi.getCandidateInfo as any).mockRejectedValue(new Error("x"));
    renderPage();

    expect(await screen.findByText("Connection problem")).toBeTruthy();
    expect(screen.queryByText("Interview Complete")).toBeNull();
  });

  it("hook calls onFatalError -> error screen with its message", async () => {
    (sessionsApi.getCandidateInfo as any).mockResolvedValue(candidate);
    renderPage();
    await waitFor(() => expect(wsOpts).toBeDefined());

    act(() => wsOpts.onFatalError("boom"));

    expect(await screen.findByText("boom")).toBeTruthy();
    expect(screen.queryByText("Interview Complete")).toBeNull();
  });

  it("onStateChange('complete') -> Interview Complete, not error", async () => {
    (sessionsApi.getCandidateInfo as any).mockResolvedValue(candidate);
    renderPage();
    await waitFor(() => expect(wsOpts).toBeDefined());

    act(() => wsOpts.onStateChange("complete"));

    expect(await screen.findByText("Interview Complete")).toBeTruthy();
    expect(screen.queryByText("Connection problem")).toBeNull();
  });
});
