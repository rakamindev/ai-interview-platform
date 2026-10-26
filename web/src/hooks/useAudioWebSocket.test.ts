import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioWebSocket } from "./useAudioWebSocket";

// Minimal stand-in for the browser WebSocket so the hook's close/reconnect logic can be driven.
class FakeSocket {
  static instances: FakeSocket[] = [];
  static OPEN = 1;
  readyState = 0;
  binaryType = "";
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  constructor(public url: string) { FakeSocket.instances.push(this); }
  send() {}
  close() { this.onclose?.(); }
  receive(msg: object) { this.onmessage?.({ data: JSON.stringify(msg) }); }
}

function setup() {
  const onStateChange = vi.fn();
  const { result } = renderHook(() =>
    useAudioWebSocket({
      sessionId: 1, token: "t", onAudioChunk: vi.fn(), onTranscript: vi.fn(), onSpeakerChange: vi.fn(), onStateChange,
    }),
  );
  act(() => result.current.connect());
  return { onStateChange, socket: () => FakeSocket.instances[FakeSocket.instances.length - 1] };
}

// F13: failures used to end on "complete", telling a candidate whose interview broke that they had finished.
describe("useAudioWebSocket failure states", () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reports a lost connection, not a completed interview, once reconnects run out", () => {
    const { onStateChange, socket } = setup();

    for (let i = 0; i < 4; i++) {
      act(() => socket().close());
      act(() => { vi.runOnlyPendingTimers(); });
    }

    expect(onStateChange).toHaveBeenLastCalledWith("connection_lost");
    expect(onStateChange).not.toHaveBeenCalledWith("complete");
  });

  it("reports failure when the server ends the session because of an error", () => {
    const { onStateChange, socket } = setup();

    act(() => socket().receive({ type: "session_ended", reason: "error" }));

    expect(onStateChange).toHaveBeenLastCalledWith("failed");
  });

  it("reports failure on a non-recoverable server error", () => {
    const { onStateChange, socket } = setup();

    act(() => socket().receive({ type: "error", recoverable: false, message: "Assessment configuration is incomplete." }));

    expect(onStateChange).toHaveBeenLastCalledWith("failed");
  });

  it("still completes on a normal end", () => {
    const { onStateChange, socket } = setup();

    act(() => socket().receive({ type: "session_ended", reason: "manual_candidate" }));

    expect(onStateChange).toHaveBeenLastCalledWith("complete");
  });
});
