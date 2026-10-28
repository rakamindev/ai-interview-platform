import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InterviewPage from "./InterviewPage";
import { FakeAudioContext, FakeWebSocket, FakeWorklet } from "@/test/audioFakes";

vi.mock("@/services/api", () => ({ WS_URL: "ws://test.invalid" }));
vi.mock("@/services/sessions", () => ({ sessionsApi: {
  getCandidateInfo: async () => ({ data: {
    session_id: 1, role_title: "Test role", time_limit_min: 45, session_status: "pending",
  } }),
  audioComplete: async () => ({ data: { ended: true } }),
} }));
// Hardware readiness is outside these interview transport tests.
vi.mock("@/components/HardwareCheck", () => ({ default: ({ onStart }: { onStart: () => void }) =>
  <button onClick={onStart}>Start Interview</button>,
}));

describe("interview audio startup", () => {
  let grantMicrophone: (stream: object) => void;
  let rejectMicrophone: (error: Error) => void;
  const stream = { getTracks: () => [{ stop() {} }] };

  beforeEach(() => {
    FakeAudioContext.reset();
    FakeWebSocket.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("AudioWorkletNode", FakeWorklet);
    vi.stubGlobal("WebSocket", FakeWebSocket);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: () => new Promise((resolve, reject) => {
        grantMicrophone = resolve; rejectMicrophone = reject;
      }) },
    });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  const renderPage = async () => {
    await act(async () => { render(<MemoryRouter initialEntries={["/interview/test-invite"]}>
      <Routes><Route path="/interview/:token" element={<InterviewPage />} /></Routes>
    </MemoryRouter>); });
    FakeAudioContext.userGesture = true;
    fireEvent.click(screen.getByRole("button", { name: "Start Interview" }));
    FakeAudioContext.userGesture = false;
  };

  it("waits for the microphone before Gemini can send a turn transition", async () => {
    await renderPage();
    expect(FakeWebSocket.instances).toHaveLength(0);
    await act(async () => grantMicrophone(stream));
    expect(FakeWebSocket.instances).toHaveLength(1);
    const ws = FakeWebSocket.instances[0];
    act(() => {
      ws.open();
      ws.receive({ type: "speaker_changed", speaker: "ai" });
      ws.receive({ type: "session_started" });
      FakeWorklet.instances[0].emit(new Int16Array([100]));
    });
    expect(ws.sent.filter((message) => message instanceof ArrayBuffer)).toHaveLength(0);
    act(() => {
      ws.receive({ type: "speaker_changed", speaker: "candidate" });
      FakeWorklet.instances[0].emit(new Int16Array([200]));
    });
    const audio = ws.sent.filter((message): message is ArrayBuffer => message instanceof ArrayBuffer);
    expect(audio.map((frame) => Array.from(new Int16Array(frame)))).toEqual([[200]]);
  });

  it("unlocks playback on Start so later Gemini audio is audible", async () => {
    FakeAudioContext.enforceAutoplay = true;
    await renderPage();
    await act(async () => grantMicrophone(stream));
    const ws = FakeWebSocket.instances[0];
    await act(async () => {
      ws.open();
      ws.receive({ type: "session_started" });
      ws.receive(new Int16Array([16384, -16384]).buffer);
    });
    const playback = FakeAudioContext.instances.find((ctx) => ctx.sampleRate === 24000);
    expect(playback?.state).toBe("running");
    expect(Array.from(playback!.scheduled[0].samples)).toEqual([0.5, -0.5]);
  });

  it("shows whose turn it is without claiming a silent candidate is speaking", async () => {
    await renderPage();
    await act(async () => grantMicrophone(stream));
    act(() => {
      const ws = FakeWebSocket.instances[0];
      ws.open();
      ws.receive({ type: "session_started" });
      ws.receive({ type: "speaker_changed", speaker: "candidate" });
    });
    expect(screen.getByText("Your turn — microphone ready")).toBeTruthy();
    expect(screen.queryByText("You're speaking")).toBeNull();
    act(() => FakeWorklet.instances[0].emit(new Int16Array([1000, -1000])));
    expect(screen.getByText("Sound detected")).toBeTruthy();
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByText("Your turn — microphone ready")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mic On" }));
    expect(screen.getByText("Microphone muted")).toBeTruthy();
  });

  it("shows a recoverable device error instead of opening a silent session", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    await renderPage();
    await act(async () => rejectMicrophone(new Error("Permission denied")));
    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(screen.getByRole("alert").textContent).toMatch(/microphone|audio/i);
    expect(screen.getByRole("button", { name: "Start Interview" })).toBeTruthy();
    consoleError.mockRestore();
  });
});
