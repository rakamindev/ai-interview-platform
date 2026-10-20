import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAudioWebSocket } from "./useAudioWebSocket";

// A server that can't be reached: every socket closes without ever opening, as when the network is gone.
class UnreachableSocket {
  static OPEN = 1;
  static created = 0;
  readyState = 0;
  binaryType = "blob";
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor() {
    UnreachableSocket.created += 1;
    setTimeout(() => {
      this.readyState = 3;
      this.onerror?.();
      this.onclose?.();
    }, 10);
  }

  send() {}
  close() {}
}

beforeEach(() => {
  vi.useFakeTimers();
  UnreachableSocket.created = 0;
  vi.stubGlobal("WebSocket", UnreachableSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useAudioWebSocket", () => {
  it("reports the interview interrupted, not complete, once every reconnect has failed", () => {
    const onStateChange = vi.fn();
    const { result } = renderHook(() =>
      useAudioWebSocket({
        sessionId: 42,
        token: "tok-test-123",
        onAudioChunk: () => {},
        onTranscript: () => {},
        onStateChange,
        onSpeakerChange: () => {},
      })
    );

    act(() => result.current.connect());
    // The first socket and three reconnects (1, 2 and 4 seconds apart) all fail.
    act(() => vi.advanceTimersByTime(10_000));

    expect(UnreachableSocket.created).toBe(4);
    expect(onStateChange).toHaveBeenLastCalledWith("interrupted");
    expect(onStateChange).not.toHaveBeenCalledWith("complete");
  });
});
