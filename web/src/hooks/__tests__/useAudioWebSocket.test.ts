import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";

// Minimal WebSocket mock with an exposed instance per connect for tests to
// dispatch synthetic open/message/close events.
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState = 0;
  binaryType = "blob";
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: unknown[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
  send(data: unknown) {
    this.sent.push(data);
  }
  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  // Test helpers
  emitOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }
  emitMessage(data: unknown) {
    // The real server sends JSON strings; object payloads are stringified
    // so the hook's `typeof data === "string"` branch is exercised.
    this.onmessage?.({ data: typeof data === "string" ? data : JSON.stringify(data) });
  }
  emitClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

vi.stubGlobal("WebSocket", MockWebSocket);

afterEach(() => {
  vi.useRealTimers();
  MockWebSocket.instances = [];
});

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 1,
    token: "tok",
    onAudioChunk: vi.fn(),
    onTranscript: vi.fn(),
    onStateChange: vi.fn(),
    onSpeakerChange: vi.fn(),
    onReconnected: vi.fn(),
    onTiming: vi.fn(),
    onTakenOver: vi.fn(),
    onFatalError: vi.fn(),
    ...overrides,
  };
}

describe("useAudioWebSocket — fatal error handling (F-07)", () => {
  it("maps an unrecoverable backend error message to state 'error' + onFatalError", () => {
    const props = makeProps();
    const { result } = renderHook(() => useAudioWebSocket(props as never));

    act(() => {
      result.current.connect();
      MockWebSocket.instances[0].emitOpen();
      MockWebSocket.instances[0].emitMessage({
        type: "error",
        code: "no_system_prompt",
        message: "Assessment configuration is incomplete.",
        recoverable: false,
      });
    });

    expect(props.onStateChange).toHaveBeenLastCalledWith("error");
    expect(props.onFatalError).toHaveBeenCalledWith({
      kind: "ws_unrecoverable",
      code: "no_system_prompt",
      message: "Assessment configuration is incomplete.",
      recoverable: false,
    });
  });

  it("keeps state 'active' for recoverable errors (no fatal path)", () => {
    const props = makeProps();
    const { result } = renderHook(() => useAudioWebSocket(props as never));

    act(() => {
      result.current.connect();
      MockWebSocket.instances[0].emitOpen();
      MockWebSocket.instances[0].emitMessage({ type: "error", recoverable: true });
    });

    expect(props.onStateChange).not.toHaveBeenCalledWith("error");
    expect(props.onFatalError).not.toHaveBeenCalled();
  });

  it("maps session_ended to state 'complete' and suppresses reconnect on close", () => {
    const props = makeProps();
    const { result } = renderHook(() => useAudioWebSocket(props as never));

    act(() => {
      result.current.connect();
      MockWebSocket.instances[0].emitOpen();
      MockWebSocket.instances[0].emitMessage({ type: "session_ended" });
      MockWebSocket.instances[0].emitClose();
    });

    expect(props.onStateChange).toHaveBeenLastCalledWith("complete");
    // No reconnect scheduling happened after a clean end.
    expect((props.onStateChange as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it("maps exhausted reconnects to state 'error' + onFatalError (connection lost)", () => {
    vi.useFakeTimers();
    const props = makeProps();
    const { result } = renderHook(() => useAudioWebSocket(props as never));

    act(() => {
      result.current.connect();
      MockWebSocket.instances[0].emitOpen();
    });

    // First close → reconnecting (attempt 0), timer schedules re-connect.
    act(() => {
      MockWebSocket.instances[0].emitClose();
    });
    expect(props.onStateChange).toHaveBeenLastCalledWith("reconnecting");

    // Each onclose schedules the next attempt. Attempts: 0,1,2 schedule
    // reconnects; attempt 3 is beyond RECONNECT_DELAYS.length → fatal error.
    for (let i = 0; i < 4; i++) {
      act(() => {
        vi.advanceTimersByTime(4000);
        const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
        ws.emitClose();
      });
    }

    expect(props.onStateChange).toHaveBeenLastCalledWith("error");
    expect(props.onFatalError).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "ws_connection_lost", recoverable: true })
    );
  });

  it("disconnect() stops reconnection scheduling", () => {
    vi.useFakeTimers();
    const props = makeProps();
    const { result } = renderHook(() => useAudioWebSocket(props as never));

    act(() => {
      result.current.connect();
      MockWebSocket.instances[0].emitOpen();
      MockWebSocket.instances[0].emitClose();
    });
    expect(props.onStateChange).toHaveBeenLastCalledWith("reconnecting");

    act(() => {
      result.current.disconnect();
    });

    // After disconnect, the state stays reconnecting — no further transitions,
    // and no new WebSocket was created.
    expect(MockWebSocket.instances.length).toBe(1);
  });

  it("disconnect() after end_session does NOT surface connection lost on close", () => {
    const props = makeProps();
    const { result } = renderHook(() => useAudioWebSocket(props as never));

    act(() => {
      result.current.connect();
      MockWebSocket.instances[0].emitOpen();
      result.current.sendJson({ type: "end_session" });
      // Mock close() fires onclose synchronously — same as the async browser
      // close after the candidate taps "End Interview".
      result.current.disconnect();
    });

    expect(props.onFatalError).not.toHaveBeenCalled();
    expect(props.onStateChange).not.toHaveBeenCalledWith("error");
    expect(props.onStateChange).not.toHaveBeenCalledWith("reconnecting");
  });

  it("surfaces session_in_use without treating it as a connection failure", () => {
    const props = makeProps();
    const { result } = renderHook(() => useAudioWebSocket(props as never));

    act(() => {
      result.current.connect();
      MockWebSocket.instances[0].emitOpen();
      MockWebSocket.instances[0].emitMessage({ type: "session_in_use" });
    });

    expect(props.onStateChange).toHaveBeenLastCalledWith("in_use");
    expect(props.onFatalError).not.toHaveBeenCalled();
  });

  it("stops reconnecting when this tab is superseded", () => {
    const props = makeProps();
    const { result } = renderHook(() => useAudioWebSocket(props as never));

    act(() => {
      result.current.connect();
      MockWebSocket.instances[0].emitOpen();
      MockWebSocket.instances[0].emitMessage({ type: "session_taken_over" });
      MockWebSocket.instances[0].emitClose();
    });

    expect(props.onTakenOver).toHaveBeenCalledOnce();
    expect(props.onStateChange).toHaveBeenLastCalledWith("taken_over");
    expect(props.onStateChange).not.toHaveBeenCalledWith("reconnecting");
  });

  it("applies server timing from session_started", () => {
    const props = makeProps();
    const { result } = renderHook(() => useAudioWebSocket(props as never));

    act(() => {
      result.current.connect();
      MockWebSocket.instances[0].emitOpen();
      MockWebSocket.instances[0].emitMessage({
        type: "session_started",
        deadline_at: "2026-10-25T01:00:00+07:00",
        remaining_seconds: 600,
      });
    });

    expect(props.onTiming).toHaveBeenCalledWith({
      deadlineAt: "2026-10-25T01:00:00+07:00",
      remainingSeconds: 600,
    });
    expect(props.onStateChange).toHaveBeenLastCalledWith("active");
  });

  it("preserves stable turn identity for transcript deduplication", () => {
    const props = makeProps();
    const { result } = renderHook(() => useAudioWebSocket(props as never));

    act(() => {
      result.current.connect();
      MockWebSocket.instances[0].emitOpen();
      MockWebSocket.instances[0].emitMessage({
        type: "transcription",
        speaker: "ai",
        text: "Welcome back",
        turn_id: 99,
        turn_number: 7,
      });
    });

    expect(props.onTranscript).toHaveBeenCalledWith(
      expect.objectContaining({ id: 99, turn_number: 7, speaker: "ai", text: "Welcome back" })
    );
  });
});
