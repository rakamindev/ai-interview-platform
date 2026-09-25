import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";

class Socket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances: Socket[] = [];
  readyState = 0;
  binaryType = "";
  onopen = () => {};
  onmessage = (_event: { data: string }) => {};
  onclose = () => {};
  onerror = () => {};
  send = vi.fn();
  close = vi.fn(() => { this.readyState = 3; this.onclose(); });
  constructor(public url: string) { Socket.instances.push(this); }
  message(data: object) { this.onmessage({ data: JSON.stringify(data) }); }
}
const options = () => ({ sessionId: 1, token: "test-invite", onAudioChunk: vi.fn(),
  onTranscript: vi.fn(), onStateChange: vi.fn(), onSpeakerChange: vi.fn(), onError: vi.fn() });
beforeEach(() => { vi.useFakeTimers(); Socket.instances = []; vi.stubGlobal("WebSocket", Socket); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("stops after three failed reconnects even if every transport opens", () => {
  const opts = options();
  const { result } = renderHook(() => useAudioWebSocket(opts));
  act(() => result.current.connect());
  for (let n = 0; n < 4; n++) {
    act(() => { const ws = Socket.instances[n]; ws.readyState = 1; ws.onopen(); ws.close(); });
    act(() => vi.runOnlyPendingTimers());
  }
  expect(Socket.instances).toHaveLength(4);
  expect(opts.onStateChange).toHaveBeenLastCalledWith("error");
});
it("does not report an upstream failure as completion", () => {
  const opts = options();
  const { result } = renderHook(() => useAudioWebSocket(opts));
  act(() => result.current.connect());
  act(() => Socket.instances[0].message({ type: "session_ended", reason: "error" }));
  expect(opts.onStateChange).toHaveBeenLastCalledWith("error");
  expect(opts.onStateChange).not.toHaveBeenCalledWith("complete");
});
it("does not reconnect after unmount or react to stale socket events", () => {
  const opts = options();
  const { result, unmount } = renderHook(() => useAudioWebSocket(opts));
  act(() => result.current.connect());
  const stale = Socket.instances[0];
  act(() => result.current.disconnect());
  act(() => result.current.connect());
  act(() => stale.message({ type: "session_started" }));
  expect(opts.onStateChange).not.toHaveBeenCalled();
  unmount();
  act(() => vi.runAllTimers());
  expect(Socket.instances).toHaveLength(2);
});
it("does not retry a nonrecoverable configuration error", () => {
  const opts = options();
  const { result } = renderHook(() => useAudioWebSocket(opts));
  act(() => result.current.connect());
  act(() => {
    Socket.instances[0].message({ type: "error", recoverable: false, message: "Unavailable" });
    Socket.instances[0].close();
    vi.runAllTimers();
  });
  expect(Socket.instances).toHaveLength(1);
  expect(opts.onError).toHaveBeenCalledWith("Unavailable");
});
