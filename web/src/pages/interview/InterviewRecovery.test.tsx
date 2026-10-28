import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InterviewPage from "./InterviewPage";
import { FakeAudioContext, FakeWebSocket, FakeWorklet } from "@/test/audioFakes";

const api = vi.hoisted(() => ({ info: vi.fn(), audioComplete: vi.fn() }));
vi.mock("@/services/api", () => ({ WS_URL: "ws://test.invalid" }));
vi.mock("@/services/sessions", () => ({ sessionsApi: { getCandidateInfo: api.info, audioComplete: api.audioComplete } }));
vi.mock("@/components/HardwareCheck", () => ({ default: ({ onStart }: { onStart: () => void }) => <button onClick={onStart}>Start Interview</button> }));

const info = (status = "active", reason: string | null = null) => ({ data: {
  session_id: 123, role_title: "Synthetic interview", time_limit_min: 45,
  session_status: status, end_reason: reason, remaining_seconds: 120,
} });
const mountPage = async () => act(async () => { render(<MemoryRouter initialEntries={["/interview/synthetic"]}><Routes><Route path="/interview/:token" element={<InterviewPage />} /></Routes></MemoryRouter>); });
async function start() {
  await mountPage();
  FakeAudioContext.userGesture = true;
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Start Interview" })));
  FakeAudioContext.userGesture = false;
  const socket = FakeWebSocket.instances[0];
  act(() => { socket.open(); socket.receive({ type: "session_started" }); socket.receive({ type: "speaker_changed", speaker: "candidate" }); });
  return socket;
}

beforeEach(() => {
  vi.useFakeTimers(); FakeAudioContext.reset(); FakeWebSocket.instances = [];
  vi.stubGlobal("AudioContext", FakeAudioContext); vi.stubGlobal("AudioWorkletNode", FakeWorklet); vi.stubGlobal("WebSocket", FakeWebSocket);
  api.info.mockReset().mockResolvedValue(info()); api.audioComplete.mockReset();
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("candidate outcome and resume", () => {
  it("shows a technical failure for ended/error instead of success after reload", async () => {
    api.info.mockResolvedValue(info("ended", "error")); await mountPage();
    expect(screen.getByRole("heading", { name: "Interview interrupted" })).toBeTruthy();
    expect(screen.queryByText("Interview Complete")).toBeNull();
    expect(screen.queryByRole("button", { name: "Start Interview" })).toBeNull();
  });
  it("only shows normal completion when the server supplies a normal end reason", async () => {
    api.info.mockResolvedValue(info("ended", "manual_candidate")); await mountPage();
    expect(screen.getByRole("heading", { name: "Interview Complete" })).toBeTruthy();
  });
  it("does not infer a successful interview from an unknown legacy end reason", async () => {
    api.info.mockResolvedValue(info("ended")); await mountPage();
    expect(screen.queryByText("Interview Complete")).toBeNull();
    expect(screen.getByRole("heading", { name: "Interview interrupted" })).toBeTruthy();
  });
  it("offers a status retry on load failure instead of claiming the interview was recorded", async () => {
    api.info.mockRejectedValueOnce(new Error("offline")); await mountPage();
    expect(screen.getByRole("heading", { name: "Unable to load interview" })).toBeTruthy();
    expect(screen.queryByText("Interview Complete")).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Try again" })));
    expect(screen.getByRole("button", { name: "Start Interview" })).toBeTruthy();
  });
  it("uses the server remaining time after a page reload", async () => {
    await start(); expect(screen.getByText(/02:00/)).toBeTruthy();
  });
  it("shows interrupted on terminal model error and releases audio", async () => {
    const socket = await start(); act(() => socket.receive({ type: "session_ended", reason: "error" }));
    expect(screen.getByRole("heading", { name: "Interview interrupted" })).toBeTruthy();
    expect(FakeAudioContext.instances.every(context => context.state === "closed")).toBe(true);
  });
  it("waits for the server acknowledgement before showing manual completion", async () => {
    const socket = await start();
    fireEvent.click(screen.getByRole("button", { name: "End Interview" }));
    fireEvent.click(screen.getByRole("button", { name: "End interview" }));
    expect(screen.queryByText("Interview Complete")).toBeNull();
    act(() => socket.receive({ type: "session_ended", reason: "manual_candidate" }));
    expect(screen.getByRole("heading", { name: "Interview Complete" })).toBeTruthy();
  });
  it("treats an unacknowledged end request as an unknown connection outcome", async () => {
    await start(); fireEvent.click(screen.getByRole("button", { name: "End Interview" }));
    fireEvent.click(screen.getByRole("button", { name: "End interview" }));
    act(() => vi.advanceTimersByTime(11000));
    expect(screen.getByRole("heading", { name: "Connection lost" })).toBeTruthy();
    expect(screen.queryByText("Interview Complete")).toBeNull();
  });
  it("keeps the end acknowledgement deadline when the socket reconnects", async () => {
    const socket = await start();
    fireEvent.click(screen.getByRole("button", { name: "End Interview" }));
    fireEvent.click(screen.getByRole("button", { name: "End interview" }));
    act(() => socket.close());
    act(() => vi.advanceTimersByTime(1000));
    const resumed = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
    act(() => { resumed.open(); resumed.receive({ type: "session_started" }); });
    expect(screen.getByRole("status").textContent).toContain("Ending interview");
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByRole("heading", { name: "Connection lost" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check session status" })).toBeTruthy();
    expect(screen.queryByText("Interview Complete")).toBeNull();
  });
  it("cancels audio-complete retries owned by a page that was unloaded", async () => {
    api.audioComplete.mockRejectedValue(new Error("offline"));
    const socket = await start();
    await act(async () => socket.receive({ type: "preparing_to_end" }));
    expect(api.audioComplete).toHaveBeenCalledTimes(1);
    cleanup();
    await act(async () => vi.advanceTimersByTime(15000));
    expect(api.audioComplete).toHaveBeenCalledTimes(1);
  });
  it("does not reconnect a socket closed by page unmount", async () => {
    await start(); cleanup(); act(() => vi.advanceTimersByTime(10000));
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
  it("stops at a connection error after retries are exhausted without claiming success", async () => {
    const socket = await start(); act(() => socket.close());
    for (const delay of [1000, 2000, 4000]) { act(() => vi.advanceTimersByTime(delay)); act(() => FakeWebSocket.instances[FakeWebSocket.instances.length - 1].close()); }
    expect(screen.getByRole("heading", { name: "Connection lost" })).toBeTruthy();
    expect(screen.queryByText("Interview Complete")).toBeNull();
  });
});
