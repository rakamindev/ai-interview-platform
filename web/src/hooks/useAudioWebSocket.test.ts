import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  binaryType = "";
  url: string;
  onopen: ((ev?: unknown) => void) | null = null;
  onmessage: ((ev?: unknown) => void) | null = null;
  onerror: ((ev?: unknown) => void) | null = null;
  onclose: ((ev?: unknown) => void) | null = null;
  send = vi.fn();
  close = vi.fn(function (this: MockWebSocket) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  });

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
}

const opts = () => ({
  sessionId: 1,
  onAudioChunk: vi.fn(),
  onTranscript: vi.fn(),
  onStateChange: vi.fn(),
  onSpeakerChange: vi.fn(),
});

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useAudioWebSocket", () => {
  it("does not open a second socket when one is already CONNECTING (P2-9)", () => {
    const { result } = renderHook(() => useAudioWebSocket(opts()));

    act(() => result.current.connect());
    act(() => result.current.connect());

    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("closes the socket and detaches handlers on unmount so no reconnect fires (P2-2)", () => {
    const { result, unmount } = renderHook(() => useAudioWebSocket(opts()));

    act(() => result.current.connect());
    const ws = MockWebSocket.instances[0];

    unmount();

    expect(ws.close).toHaveBeenCalled();
    expect(ws.onclose).toBeNull();
    expect(MockWebSocket.instances).toHaveLength(1);
  });
});
