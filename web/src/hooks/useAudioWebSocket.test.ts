import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioWebSocket } from "./useAudioWebSocket";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;

  readyState = 0;
  binaryType = "";
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }

  simulateOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(payload: object) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  simulateServerClose() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
}

function setupHook(onStateChange = vi.fn()) {
  const hook = renderHook(() =>
    useAudioWebSocket({
      sessionId: 1,
      onAudioChunk: vi.fn(),
      onTranscript: vi.fn(),
      onStateChange,
      onSpeakerChange: vi.fn(),
    })
  );
  return { hook, onStateChange };
}

describe("useAudioWebSocket error routing", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // Regression: assessment/gap-analysis.md P0-3 — a non-recoverable server
  // error used to route to onStateChange("complete"), the same happy-path
  // state as a real successful finish.
  it("reports error(server_error) instead of complete on a non-recoverable server error", () => {
    const { hook, onStateChange } = setupHook();
    act(() => hook.result.current.connect());
    const ws = FakeWebSocket.instances[0];
    act(() => ws.simulateOpen());

    act(() => ws.simulateMessage({ type: "error", recoverable: false, message: "boom" }));

    expect(onStateChange).toHaveBeenCalledWith("error", { reason: "server_error", message: "boom" });
    expect(onStateChange).not.toHaveBeenCalledWith("complete");
  });

  // Regression: reconnect exhausted (3 attempts, ~7s total) used to route to
  // onStateChange("complete") too — a candidate whose connection dropped for
  // good saw the same "thank you" screen as someone who actually finished.
  it("reports error(connection_lost) instead of complete once reconnect attempts are exhausted", () => {
    const { hook, onStateChange } = setupHook();
    act(() => hook.result.current.connect());

    // 3 retries (1s, 2s, 4s) then the 4th drop is the one that's exhausted.
    for (let i = 0; i < 4; i++) {
      const ws = FakeWebSocket.instances[i];
      act(() => ws.simulateServerClose());
      act(() => vi.advanceTimersByTime(4000));
    }

    expect(onStateChange).toHaveBeenCalledWith("error", { reason: "connection_lost" });
    expect(onStateChange).not.toHaveBeenCalledWith("complete");
  });

  it("still reports complete for a real session_ended message", () => {
    const { hook, onStateChange } = setupHook();
    act(() => hook.result.current.connect());
    const ws = FakeWebSocket.instances[0];
    act(() => ws.simulateOpen());

    act(() => ws.simulateMessage({ type: "session_ended" }));
    act(() => ws.simulateServerClose());

    expect(onStateChange).toHaveBeenCalledWith("complete");
    expect(onStateChange).not.toHaveBeenCalledWith("error", expect.anything());
  });

  // Regression risk introduced by this very fix: disconnect() maxes out the
  // reconnect counter (to prevent auto-reconnect after a deliberate close),
  // which would otherwise look identical to "reconnect exhausted" once that
  // branch reports "error" instead of "complete".
  it("does not report an error when the candidate manually ends the interview", () => {
    const { hook, onStateChange } = setupHook();
    act(() => hook.result.current.connect());
    const ws = FakeWebSocket.instances[0];
    act(() => ws.simulateOpen());

    act(() => hook.result.current.disconnect());

    expect(onStateChange).not.toHaveBeenCalledWith("error", expect.anything());
  });
});
