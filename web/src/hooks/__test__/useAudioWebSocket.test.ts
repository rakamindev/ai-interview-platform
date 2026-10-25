import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useAudioWebSocket } from "../useAudioWebSocket";

vi.mock("@/services/api", () => ({
  WS_URL: "ws://test-host",
}));

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 20000, 20000, 20000];

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static readonly OPEN = 1;

  url: string;
  readyState = 0;
  binaryType = "";
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: unknown[] = [];

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: unknown) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  // Test helpers
  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  message(data: unknown) {
    this.onmessage?.({ data });
  }

  closeUnexpectedly() {
    this.readyState = 3;
    this.onclose?.();
  }
}

describe("useAudioWebSocket", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function renderAudioHook() {
    const handlers = {
      onAudioChunk: vi.fn(),
      onTranscript: vi.fn(),
      onStateChange: vi.fn(),
      onSpeakerChange: vi.fn(),
      onReconnected: vi.fn(),
      onSessionEnded: vi.fn(),
    };
    const { result } = renderHook(() =>
      useAudioWebSocket({ sessionId: 42, token: "tok-1", ...handlers }),
    );
    return { result, handlers };
  }

  function connect() {
    return FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
  }

  test("connects to the session audio URL with the token and authenticates on open", () => {
    const { result } = renderAudioHook();

    act(() => {
      result.current.connect();
    });
    const ws = connect();
    expect(ws.url).toContain("/ws/sessions/42/audio");
    expect(ws.url).toContain("token=tok-1");

    act(() => {
      ws.open();
    });
    expect(result.current.connectionState).toBe("connected");
    expect(ws.sent[0]).toBe(JSON.stringify({ type: "auth", token: "tok-1" }));
  });

  test("forwards binary chunks and signals the AI speaker once per turn", () => {
    const { result, handlers } = renderAudioHook();
    act(() => {
      result.current.connect();
    });
    const ws = connect();
    act(() => {
      ws.open();
    });

    const chunk = new ArrayBuffer(8);
    act(() => {
      ws.message(chunk);
      ws.message(chunk);
    });

    expect(handlers.onAudioChunk).toHaveBeenCalledTimes(2);
    expect(handlers.onSpeakerChange).toHaveBeenCalledTimes(1);
    expect(handlers.onSpeakerChange).toHaveBeenCalledWith("ai");
  });

  test("speaker_changed:candidate re-arms the AI-speaker signal for the next turn", () => {
    const { result, handlers } = renderAudioHook();
    act(() => {
      result.current.connect();
    });
    const ws = connect();
    act(() => {
      ws.open();
    });

    act(() => {
      ws.message(new ArrayBuffer(8));
      ws.message(JSON.stringify({ type: "speaker_changed", speaker: "candidate" }));
      ws.message(new ArrayBuffer(8));
    });

    expect(handlers.onSpeakerChange).toHaveBeenNthCalledWith(1, "ai");
    expect(handlers.onSpeakerChange).toHaveBeenNthCalledWith(2, "candidate");
    expect(handlers.onSpeakerChange).toHaveBeenNthCalledWith(3, "ai");
  });

  test("maps transcription frames to transcript turns", () => {
    const { result, handlers } = renderAudioHook();
    act(() => {
      result.current.connect();
    });
    const ws = connect();
    act(() => {
      ws.open();
    });

    act(() => {
      ws.message(JSON.stringify({ type: "transcription", speaker: "candidate", text: "hello", turn_number: 3 }));
    });

    expect(handlers.onTranscript).toHaveBeenCalledWith({ speaker: "candidate", text: "hello" });
  });

  test("reconnects with the backoff ladder after an unexpected close", () => {
    const { result, handlers } = renderAudioHook();
    act(() => {
      result.current.connect();
    });
    const ws = connect();
    act(() => {
      ws.open();
    });

    act(() => {
      ws.closeUnexpectedly();
    });
    expect(handlers.onStateChange).toHaveBeenCalledWith("reconnecting");
    expect(result.current.connectionState).toBe("disconnected");

    // First delay: 1000ms
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(FakeWebSocket.instances).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(FakeWebSocket.instances).toHaveLength(2);

    // Second delay: 2000ms
    act(() => {
      connect().closeUnexpectedly();
      vi.advanceTimersByTime(1999);
    });
    expect(FakeWebSocket.instances).toHaveLength(2);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(FakeWebSocket.instances).toHaveLength(3);
  });

  test("resets the ladder after a successful reconnect", () => {
    const { result } = renderAudioHook();
    act(() => {
      result.current.connect();
    });
    act(() => {
      connect().open();
    });

    // Burn two attempts, then reconnect successfully.
    act(() => {
      connect().closeUnexpectedly();
      vi.advanceTimersByTime(RECONNECT_DELAYS[0]);
    });
    act(() => {
      connect().closeUnexpectedly();
      vi.advanceTimersByTime(RECONNECT_DELAYS[1]);
    });
    act(() => {
      connect().open();
    });
    expect(result.current.connectionState).toBe("connected");

    // The next unexpected close starts over at the first delay, not the third.
    act(() => {
      connect().closeUnexpectedly();
      vi.advanceTimersByTime(RECONNECT_DELAYS[0]);
    });
    expect(FakeWebSocket.instances).toHaveLength(4);
  });

  test("does not reconnect after session_ended", () => {
    const { result, handlers } = renderAudioHook();
    act(() => {
      result.current.connect();
    });
    const ws = connect();
    act(() => {
      ws.open();
    });

    act(() => {
      ws.message(
        JSON.stringify({ type: "session_ended", reason: "manual_assessor", message: "ended by assessor" }),
      );
    });
    expect(handlers.onSessionEnded).toHaveBeenCalledWith("manual_assessor", "ended by assessor");
    expect(handlers.onStateChange).toHaveBeenCalledWith("complete");

    act(() => {
      ws.closeUnexpectedly();
      vi.advanceTimersByTime(RECONNECT_DELAYS.reduce((a, b) => a + b, 0));
    });
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  test("does not reconnect after a fatal (non-recoverable) error frame", () => {
    const { result, handlers } = renderAudioHook();
    act(() => {
      result.current.connect();
    });
    const ws = connect();
    act(() => {
      ws.open();
    });

    act(() => {
      ws.message(JSON.stringify({ type: "error", code: "auth_failed", message: "bad token", recoverable: false }));
    });
    expect(handlers.onSessionEnded).toHaveBeenCalledWith("error", "bad token");

    act(() => {
      ws.closeUnexpectedly();
      vi.advanceTimersByTime(RECONNECT_DELAYS.reduce((a, b) => a + b, 0));
    });
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  test("gives up honestly after exhausting the reconnect ladder", () => {
    const { result, handlers } = renderAudioHook();
    act(() => {
      result.current.connect();
    });

    const total = RECONNECT_DELAYS.reduce((a, b) => a + b, 0);
    for (let i = 0; i <= RECONNECT_DELAYS.length; i += 1) {
      act(() => {
        connect().closeUnexpectedly();
        vi.advanceTimersByTime(total);
      });
    }

    // initial connection + one per ladder rung
    expect(FakeWebSocket.instances).toHaveLength(RECONNECT_DELAYS.length + 1);
    expect(handlers.onSessionEnded).toHaveBeenCalledWith(
      undefined,
      "The connection was lost before the interview finished.",
    );
    expect(handlers.onStateChange).toHaveBeenCalledWith("complete");
    expect(result.current.connectionState).toBe("disconnected");
  });

  test("disconnect() suppresses any further reconnection", () => {
    const { result } = renderAudioHook();
    act(() => {
      result.current.connect();
    });
    act(() => {
      connect().open();
    });

    act(() => {
      result.current.disconnect();
    });
    act(() => {
      vi.advanceTimersByTime(RECONNECT_DELAYS.reduce((a, b) => a + b, 0));
    });
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
