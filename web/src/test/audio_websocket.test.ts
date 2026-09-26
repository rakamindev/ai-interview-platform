import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  url: string;
  binaryType: string = "blob";
  readyState: number = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  sentData: (string | ArrayBuffer)[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string | ArrayBuffer) {
    this.sentData.push(data);
  }

  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose();
  }

  triggerOpen() {
    this.readyState = 1;
    if (this.onopen) this.onopen();
  }

  triggerMessage(data: unknown) {
    if (this.onmessage) this.onmessage({ data });
  }

  triggerError() {
    if (this.onerror) this.onerror();
  }
}

describe("useAudioWebSocket Hook", () => {
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
    if (typeof window !== "undefined") {
      window.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.stubGlobal("WebSocket", originalWebSocket);
  });

  it("connects to the session audio url and sends token on open", () => {
    const onAudioChunk = vi.fn();
    const onTranscript = vi.fn();
    const onStateChange = vi.fn();
    const onSpeakerChange = vi.fn();

    const { result } = renderHook(() =>
      useAudioWebSocket({
        sessionId: 42,
        token: "tok_test123",
        onAudioChunk,
        onTranscript,
        onStateChange,
        onSpeakerChange,
      })
    );

    expect(result.current.connectionState).toBe("disconnected");

    act(() => {
      result.current.connect();
    });

    expect(MockWebSocket.instances.length).toBe(1);
    const ws = MockWebSocket.instances[0];
    expect(ws.url).toContain("/ws/sessions/42/audio?token=tok_test123");
    expect(result.current.connectionState).toBe("connecting");

    act(() => {
      ws.triggerOpen();
    });

    expect(result.current.connectionState).toBe("connected");
    expect(ws.sentData).toContain(JSON.stringify({ type: "auth", token: "tok_test123" }));
  });

  it("dispatches binary audio chunks and signals ai speaker", () => {
    const onAudioChunk = vi.fn();
    const onTranscript = vi.fn();
    const onStateChange = vi.fn();
    const onSpeakerChange = vi.fn();

    const { result } = renderHook(() =>
      useAudioWebSocket({
        sessionId: 42,
        token: "tok_test123",
        onAudioChunk,
        onTranscript,
        onStateChange,
        onSpeakerChange,
      })
    );

    act(() => {
      result.current.connect();
    });

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    const buffer = new ArrayBuffer(16);
    act(() => {
      ws.triggerMessage(buffer);
    });

    expect(onAudioChunk).toHaveBeenCalledWith(buffer);
    expect(onSpeakerChange).toHaveBeenCalledWith("ai");
  });

  it("dispatches json control messages correctly", () => {
    const onAudioChunk = vi.fn();
    const onTranscript = vi.fn();
    const onStateChange = vi.fn();
    const onSpeakerChange = vi.fn();

    const { result } = renderHook(() =>
      useAudioWebSocket({
        sessionId: 42,
        token: "tok_test123",
        onAudioChunk,
        onTranscript,
        onStateChange,
        onSpeakerChange,
      })
    );

    act(() => {
      result.current.connect();
    });

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    act(() => {
      ws.triggerMessage(JSON.stringify({ type: "session_started" }));
    });
    expect(onStateChange).toHaveBeenCalledWith("active");

    act(() => {
      ws.triggerMessage(JSON.stringify({ type: "transcript", speaker: "candidate", text: "Hello" }));
    });
    expect(onTranscript).toHaveBeenCalledWith({ speaker: "candidate", text: "Hello" });

    act(() => {
      ws.triggerMessage(JSON.stringify({ type: "speaker_changed", speaker: "candidate" }));
    });
    expect(onSpeakerChange).toHaveBeenCalledWith("candidate");

    act(() => {
      ws.triggerMessage(JSON.stringify({ type: "session_ended" }));
    });
    expect(onStateChange).toHaveBeenCalledWith("complete");
  });

  it("handles reconnect backoff delay on unexpected close", () => {
    const onAudioChunk = vi.fn();
    const onTranscript = vi.fn();
    const onStateChange = vi.fn();
    const onSpeakerChange = vi.fn();

    const { result } = renderHook(() =>
      useAudioWebSocket({
        sessionId: 42,
        token: "tok_test123",
        onAudioChunk,
        onTranscript,
        onStateChange,
        onSpeakerChange,
      })
    );

    act(() => {
      result.current.connect();
    });

    const ws1 = MockWebSocket.instances[0];
    act(() => {
      ws1.triggerOpen();
    });

    act(() => {
      ws1.close();
    });

    expect(onStateChange).toHaveBeenCalledWith("reconnecting");
    expect(MockWebSocket.instances.length).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(MockWebSocket.instances.length).toBe(2);
  });

  it("cleans up websocket connection when unmounted", () => {
    const onAudioChunk = vi.fn();
    const onTranscript = vi.fn();
    const onStateChange = vi.fn();
    const onSpeakerChange = vi.fn();

    const { result, unmount } = renderHook(() =>
      useAudioWebSocket({
        sessionId: 42,
        token: "tok_test123",
        onAudioChunk,
        onTranscript,
        onStateChange,
        onSpeakerChange,
      })
    );

    act(() => {
      result.current.connect();
    });

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    expect(ws.readyState).toBe(1);

    unmount();

    expect(ws.readyState).toBe(3);
  });
});
