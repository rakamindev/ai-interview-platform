import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;

  readyState = 0;
  binaryType = "";
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: unknown[] = [];

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: unknown) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  // Test helpers — not part of the real WebSocket API.
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(payload: object) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

describe("useAudioWebSocket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    // @ts-expect-error — replacing global WebSocket with a test double
    global.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const onStateChange = vi.fn();
    const onError = vi.fn();
    const hook = renderHook(() =>
      useAudioWebSocket({
        sessionId: 1,
        onAudioChunk: vi.fn(),
        onTranscript: vi.fn(),
        onStateChange,
        onSpeakerChange: vi.fn(),
        onError,
      })
    );
    return { onStateChange, onError, hook };
  }

  test("sets state to connection_lost, not complete, when all reconnect attempts are exhausted", () => {
    const { onStateChange, hook } = setup();

    act(() => {
      hook.result.current.connect();
    });
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    // Disconnect and exhaust all 3 reconnect attempts (delays: 1000, 2000, 4000ms).
    // Each close schedules the next attempt; the 4th close (after all delays
    // have been consumed) is the one that gives up.
    act(() => {
      MockWebSocket.instances[0].simulateClose();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
      MockWebSocket.instances[1].simulateClose();
    });
    act(() => {
      vi.advanceTimersByTime(2000);
      MockWebSocket.instances[2].simulateClose();
    });
    act(() => {
      vi.advanceTimersByTime(4000);
      MockWebSocket.instances[3].simulateClose();
    });

    expect(onStateChange).toHaveBeenCalledWith("connection_lost");
    expect(onStateChange).not.toHaveBeenCalledWith("complete");
  });

  test("recovers to active state when a reconnect attempt succeeds before delays are exhausted", () => {
    const { onStateChange, hook } = setup();

    act(() => {
      hook.result.current.connect();
    });
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });
    act(() => {
      MockWebSocket.instances[0].simulateClose();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      MockWebSocket.instances[1].simulateOpen();
      MockWebSocket.instances[1].simulateMessage({ type: "reconnected" });
    });

    expect(onStateChange).toHaveBeenCalledWith("active");
    expect(onStateChange).not.toHaveBeenCalledWith("connection_lost");
    expect(onStateChange).not.toHaveBeenCalledWith("complete");
  });

  test("still sets complete when the backend sends session_ended while reconnecting", () => {
    const { onStateChange, hook } = setup();

    act(() => {
      hook.result.current.connect();
    });
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
      MockWebSocket.instances[0].simulateMessage({ type: "session_ended" });
    });
    act(() => {
      MockWebSocket.instances[0].simulateClose();
    });

    expect(onStateChange).toHaveBeenCalledWith("complete");
  });

  test("surfaces a recoverable error (e.g. a failed text_input send) via onError instead of silently dropping it", () => {
    const { onError, onStateChange, hook } = setup();

    act(() => {
      hook.result.current.connect();
    });
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
      MockWebSocket.instances[0].simulateMessage({
        type: "error",
        message: "Unable to send message — session is not connected.",
        recoverable: true,
      });
    });

    expect(onError).toHaveBeenCalledWith("Unable to send message — session is not connected.");
    expect(onStateChange).not.toHaveBeenCalledWith("complete");
  });
});
