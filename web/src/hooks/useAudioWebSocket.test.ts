import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioWebSocket } from "./useAudioWebSocket";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;

  readyState = FakeWebSocket.OPEN;
  binaryType = "";
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: unknown[] = [];

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: unknown) {
    this.sent.push(data);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }

  // test helper: simulate the server dropping the connection
  simulateDrop() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
}

describe("useAudioWebSocket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    // @ts-expect-error test double
    global.WebSocket = FakeWebSocket;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const onStateChange = vi.fn();
    const { result } = renderHook(() =>
      useAudioWebSocket({
        sessionId: 1,
        token: "tok",
        onAudioChunk: vi.fn(),
        onTranscript: vi.fn(),
        onStateChange,
        onSpeakerChange: vi.fn(),
      })
    );
    return { result, onStateChange };
  }

  it("reports connection_failed once reconnect attempts are exhausted", () => {
    const { result, onStateChange } = setup();

    act(() => result.current.connect());
    const first = FakeWebSocket.instances[0];
    act(() => first.simulateDrop());
    expect(onStateChange).toHaveBeenCalledWith("reconnecting");

    // exhaust all 3 reconnect delays (1000, 2000, 4000ms)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const second = FakeWebSocket.instances[1];
    act(() => second.simulateDrop());

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    const third = FakeWebSocket.instances[2];
    act(() => third.simulateDrop());

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    const fourth = FakeWebSocket.instances[3];
    act(() => fourth.simulateDrop());

    expect(onStateChange).toHaveBeenCalledWith("connection_failed");
    expect(onStateChange).not.toHaveBeenCalledWith("complete");
  });

  it("does not report connection_failed on an intentional disconnect", () => {
    const { result, onStateChange } = setup();

    act(() => result.current.connect());
    const ws = FakeWebSocket.instances[0];
    act(() => result.current.disconnect());

    expect(ws.readyState).toBe(FakeWebSocket.CLOSED);
    expect(onStateChange).not.toHaveBeenCalledWith("connection_failed");
  });
});
