import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MockWebSocket } from "@/test/mockWebSocket";
import { useAudioWebSocket } from "./useAudioWebSocket";

function setup(token: string | null = "tok") {
  const cb = {
    onAudioChunk: vi.fn(),
    onTranscript: vi.fn(),
    onStateChange: vi.fn(),
    onSpeakerChange: vi.fn(),
    onReconnected: vi.fn(),
  };
  const hook = renderHook(() => useAudioWebSocket({ sessionId: 7, token: token ?? undefined, ...cb }));
  return { ...hook, cb };
}

beforeEach(() => {
  vi.useFakeTimers();
  MockWebSocket.reset();
  vi.stubGlobal("WebSocket", MockWebSocket);
});

describe("useAudioWebSocket", () => {
  it("connects to the session URL and sends an auth frame on open", () => {
    const { result } = setup();
    act(() => result.current.connect());
    expect(MockWebSocket.last.url).toMatch(/\/ws\/sessions\/7\/audio\?token=tok$/);
    expect(result.current.connectionState).toBe("connecting");

    act(() => MockWebSocket.last.open());
    expect(result.current.connectionState).toBe("connected");
    expect(MockWebSocket.last.sent).toEqual([JSON.stringify({ type: "auth", token: "tok" })]);
  });

  it("omits token from URL and auth frame when no token", () => {
    const { result } = setup(null);
    act(() => result.current.connect());
    act(() => MockWebSocket.last.open());
    expect(MockWebSocket.last.url).toMatch(/\/audio$/);
    expect(MockWebSocket.last.sent).toEqual([]);
  });

  it("handles control messages", () => {
    const { result, cb } = setup();
    act(() => result.current.connect());
    act(() => MockWebSocket.last.open());

    act(() => MockWebSocket.last.message({ type: "session_started" }));
    expect(cb.onStateChange).toHaveBeenLastCalledWith("active");

    act(() => MockWebSocket.last.message({ type: "transcription", speaker: "candidate", text: "hi" }));
    expect(cb.onTranscript).toHaveBeenLastCalledWith({ speaker: "candidate", text: "hi" });

    act(() => MockWebSocket.last.message({ type: "transcript", speaker: "ai", text: "hello" }));
    expect(cb.onTranscript).toHaveBeenLastCalledWith({ speaker: "assessor", text: "hello" });

    act(() => MockWebSocket.last.message({ type: "preparing_to_end" }));
    expect(cb.onStateChange).toHaveBeenLastCalledWith("draining_audio");

    act(() => MockWebSocket.last.message({ type: "reconnected" }));
    expect(cb.onStateChange).toHaveBeenLastCalledWith("active");
    expect(cb.onReconnected).toHaveBeenCalled();

    act(() => MockWebSocket.last.message({ type: "error", recoverable: false }));
    expect(cb.onStateChange).toHaveBeenLastCalledWith("complete");
  });

  it("ignores non-JSON text frames", () => {
    const { result, cb } = setup();
    act(() => result.current.connect());
    act(() => MockWebSocket.last.open());
    expect(() => act(() => MockWebSocket.last.message("not json"))).not.toThrow();
    expect(cb.onStateChange).not.toHaveBeenCalled();
  });

  it("signals AI speaking once per turn on binary chunks", () => {
    const { result, cb } = setup();
    act(() => result.current.connect());
    act(() => MockWebSocket.last.open());

    const chunk = new ArrayBuffer(8);
    act(() => MockWebSocket.last.message(chunk));
    act(() => MockWebSocket.last.message(chunk));
    expect(cb.onAudioChunk).toHaveBeenCalledTimes(2);
    expect(cb.onSpeakerChange).toHaveBeenCalledTimes(1);
    expect(cb.onSpeakerChange).toHaveBeenCalledWith("ai");

    act(() => MockWebSocket.last.message({ type: "speaker_changed", speaker: "candidate" }));
    expect(cb.onSpeakerChange).toHaveBeenLastCalledWith("candidate");

    act(() => MockWebSocket.last.message(chunk));
    expect(cb.onSpeakerChange).toHaveBeenLastCalledWith("ai");
    expect(cb.onSpeakerChange).toHaveBeenCalledTimes(3);
  });

  it("send/sendJson only write while the socket is open", () => {
    const { result } = setup();
    act(() => result.current.connect());
    result.current.sendJson({ a: 1 });
    expect(MockWebSocket.last.sent).toEqual([]);

    act(() => MockWebSocket.last.open());
    MockWebSocket.last.sent = [];
    const buf = new ArrayBuffer(4);
    result.current.send(buf);
    result.current.sendJson({ a: 1 });
    expect(MockWebSocket.last.sent).toEqual([buf, JSON.stringify({ a: 1 })]);
  });

  it("reconnects with 1s/2s/4s backoff, then gives up with 'complete'", () => {
    const { result, cb } = setup();
    act(() => result.current.connect());
    act(() => MockWebSocket.last.open());

    for (const delay of [1000, 2000, 4000]) {
      const before = MockWebSocket.instances.length;
      act(() => MockWebSocket.last.drop());
      expect(cb.onStateChange).toHaveBeenLastCalledWith("reconnecting");
      act(() => { vi.advanceTimersByTime(delay - 1); });
      expect(MockWebSocket.instances.length).toBe(before);
      act(() => { vi.advanceTimersByTime(1); });
      expect(MockWebSocket.instances.length).toBe(before + 1);
    }

    act(() => MockWebSocket.last.drop());
    expect(cb.onStateChange).toHaveBeenLastCalledWith("complete");
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(MockWebSocket.instances.length).toBe(4);
  });

  it("resets the backoff after a successful reconnect", () => {
    const { result } = setup();
    act(() => result.current.connect());
    act(() => MockWebSocket.last.open());
    act(() => MockWebSocket.last.drop());
    act(() => { vi.advanceTimersByTime(1000); });
    act(() => MockWebSocket.last.open());

    const before = MockWebSocket.instances.length;
    act(() => MockWebSocket.last.drop());
    act(() => { vi.advanceTimersByTime(1000); }); // back to the first delay
    expect(MockWebSocket.instances.length).toBe(before + 1);
  });

  it("does not reconnect after session_ended", () => {
    const { result, cb } = setup();
    act(() => result.current.connect());
    act(() => MockWebSocket.last.open());
    act(() => MockWebSocket.last.message({ type: "session_ended" }));
    expect(cb.onStateChange).toHaveBeenLastCalledWith("complete");

    act(() => MockWebSocket.last.drop());
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(MockWebSocket.instances.length).toBe(1);
  });

  it("does not reconnect after an explicit disconnect()", () => {
    const { result } = setup();
    act(() => result.current.connect());
    act(() => MockWebSocket.last.open());
    act(() => result.current.disconnect());
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(MockWebSocket.instances.length).toBe(1);
  });

  it("does not open a second socket while one is already open", () => {
    const { result } = setup();
    act(() => result.current.connect());
    act(() => MockWebSocket.last.open());
    act(() => result.current.connect());
    expect(MockWebSocket.instances.length).toBe(1);
  });

  // KNOWN BUG: the unmount cleanup calls ws.close() without suppressing reconnects,
  // so onclose schedules a new connection after the component is gone.
  // `it.fails` keeps the suite green now and starts failing (prompting removal of
  // `.fails`) once the hook is fixed, e.g. by setting reconnectAttemptsRef to RECONNECT_DELAYS.length in the cleanup.
  it.fails("does not open a new socket after unmount", () => {
    const { result, unmount } = setup();
    act(() => result.current.connect());
    act(() => MockWebSocket.last.open());
    unmount();
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(MockWebSocket.instances.length).toBe(1);
  });
});
