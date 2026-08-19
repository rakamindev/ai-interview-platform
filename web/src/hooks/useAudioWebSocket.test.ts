import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { renderHook, act } from "@testing-library/react";
import { useAudioWebSocket } from "./useAudioWebSocket";
import { MockWebSocket } from "@/test/setup";

const AC = globalThis as unknown as { WebSocket: typeof MockWebSocket };

function wsInstances() {
  return AC.WebSocket.instances;
}

function setup(options: Partial<Parameters<typeof useAudioWebSocket>[0]> = {}) {
  const callbacks = {
    onAudioChunk: vi.fn(),
    onTranscript: vi.fn(),
    onStateChange: vi.fn(),
    onSpeakerChange: vi.fn(),
    onReconnected: vi.fn(),
  };
  const { result, unmount } = renderHook(() =>
    useAudioWebSocket({ sessionId: 7, token: "tok", ...callbacks, ...options }),
  );
  act(() => result.current.connect());
  return { result, unmount, ...callbacks };
}

describe("useAudioWebSocket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    AC.WebSocket.instances.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("connects with the token in the URL, sets binary mode and authenticates on open", () => {
    const { result } = setup();

    expect(wsInstances()).toHaveLength(1);
    expect(wsInstances()[0].url).toContain("/ws/sessions/7/audio?token=tok");
    expect(wsInstances()[0].binaryType).toBe("arraybuffer");
    expect(result.current.connectionState).toBe("connecting");

    act(() => wsInstances()[0].serverOpen());
    expect(result.current.connectionState).toBe("connected");
    expect(wsInstances()[0].send).toHaveBeenCalledWith(
      JSON.stringify({ type: "auth", token: "tok" }),
    );
  });

  it("forwards binary frames and signals the AI speaker once per turn", () => {
    const { result, onAudioChunk, onSpeakerChange } = setup();
    act(() => wsInstances()[0].serverOpen());

    const frame1 = new ArrayBuffer(4);
    const frame2 = new ArrayBuffer(8);
    act(() => wsInstances()[0].onmessage?.({ data: frame1 } as never));
    act(() => wsInstances()[0].onmessage?.({ data: frame2 } as never));

    expect(onAudioChunk).toHaveBeenNthCalledWith(1, frame1);
    expect(onAudioChunk).toHaveBeenNthCalledWith(2, frame2);
    expect(onSpeakerChange).toHaveBeenCalledTimes(1);
    expect(onSpeakerChange).toHaveBeenCalledWith("ai");
    expect(result.current.connectionState).toBe("connected");
  });

  it("maps transcription frames to candidate/assessor speakers", () => {
    const { onTranscript } = setup();

    act(() =>
      wsInstances()[0].serverMessage(
        JSON.stringify({ type: "transcription", speaker: "candidate", text: "hi" }),
      ),
    );
    act(() =>
      wsInstances()[0].serverMessage(
        JSON.stringify({ type: "transcript", speaker: "ai", text: "hello" }),
      ),
    );

    expect(onTranscript).toHaveBeenNthCalledWith(1, { speaker: "candidate", text: "hi" });
    expect(onTranscript).toHaveBeenNthCalledWith(2, { speaker: "assessor", text: "hello" });
  });

  it("resets the AI-speaker signal on speaker_changed:candidate", () => {
    const { onSpeakerChange } = setup();
    act(() => wsInstances()[0].serverOpen());

    act(() => wsInstances()[0].onmessage?.({ data: new ArrayBuffer(4) } as never));
    act(() =>
      wsInstances()[0].serverMessage(
        JSON.stringify({ type: "speaker_changed", speaker: "candidate" }),
      ),
    );
    act(() => wsInstances()[0].onmessage?.({ data: new ArrayBuffer(4) } as never));

    expect(onSpeakerChange.mock.calls.map((c) => c[0])).toEqual(["ai", "candidate", "ai"]);
  });

  it("does not duplicate the AI-speaker signal on speaker_changed:ai", () => {
    const { onSpeakerChange } = setup();
    act(() => wsInstances()[0].serverOpen());

    act(() =>
      wsInstances()[0].serverMessage(JSON.stringify({ type: "speaker_changed", speaker: "ai" })),
    );
    act(() =>
      wsInstances()[0].serverMessage(JSON.stringify({ type: "speaker_changed", speaker: "ai" })),
    );

    expect(onSpeakerChange).toHaveBeenCalledTimes(1);
    expect(onSpeakerChange).toHaveBeenCalledWith("ai");
  });

  it("handles control messages for session lifecycle", () => {
    const { result, onStateChange, onReconnected } = setup();
    const send = (msg: object) => act(() => wsInstances()[0].serverMessage(JSON.stringify(msg)));

    send({ type: "session_started" });
    expect(onStateChange).toHaveBeenLastCalledWith("active");

    send({ type: "preparing_to_end" });
    expect(onStateChange).toHaveBeenLastCalledWith("draining_audio");

    send({ type: "reconnecting" });
    expect(onStateChange).toHaveBeenLastCalledWith("reconnecting");

    send({ type: "reconnected" });
    expect(onStateChange).toHaveBeenLastCalledWith("active");
    expect(onReconnected).toHaveBeenCalledTimes(1);

    send({ type: "session_ended" });
    expect(onStateChange).toHaveBeenLastCalledWith("complete");

    // session ended → close does not reconnect
    act(() => wsInstances()[0].serverClose());
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(wsInstances()).toHaveLength(1);
    expect(result.current.connectionState).toBe("disconnected");
  });

  it("only completes on non-recoverable errors", () => {
    const { onStateChange } = setup();

    act(() => wsInstances()[0].serverMessage(JSON.stringify({ type: "error", recoverable: true })));
    expect(onStateChange).not.toHaveBeenCalled();

    act(() =>
      wsInstances()[0].serverMessage(JSON.stringify({ type: "error", recoverable: false })),
    );
    expect(onStateChange).toHaveBeenCalledWith("complete");
  });

  it("marks the connection disconnected when the socket errors", () => {
    const { result } = setup();
    act(() => wsInstances()[0].serverOpen());
    expect(result.current.connectionState).toBe("connected");

    act(() => wsInstances()[0].onerror?.({}));
    expect(result.current.connectionState).toBe("disconnected");
  });

  it("send and sendJson forward payloads to the socket", () => {
    const { result } = setup();
    act(() => wsInstances()[0].serverOpen());

    const buffer = new ArrayBuffer(2);
    act(() => result.current.send(buffer));
    expect(wsInstances()[0].send).toHaveBeenCalledWith(buffer);

    act(() => result.current.sendJson({ type: "ping" }));
    expect(wsInstances()[0].send).toHaveBeenCalledWith(JSON.stringify({ type: "ping" }));
  });

  it("reconnects with backoff and completes after the delays are exhausted", () => {
    const { result, onStateChange } = setup();

    act(() => wsInstances()[0].serverClose());
    expect(onStateChange).toHaveBeenLastCalledWith("reconnecting");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(wsInstances()).toHaveLength(2);
    act(() => wsInstances()[1].serverClose());

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(wsInstances()).toHaveLength(3);
    act(() => wsInstances()[2].serverClose());

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(wsInstances()).toHaveLength(4);
    act(() => wsInstances()[3].serverClose());

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(wsInstances()).toHaveLength(4);
    expect(onStateChange).toHaveBeenLastCalledWith("complete");
    expect(result.current.connectionState).toBe("disconnected");
  });

  it("disconnect prevents further reconnects", () => {
    const { result } = setup();
    act(() => wsInstances()[0].serverClose());
    act(() => result.current.disconnect());

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(wsInstances()).toHaveLength(1);
    expect(wsInstances()[0].close).toHaveBeenCalled();
  });

  it("closes the socket on unmount", () => {
    const { unmount } = setup();
    act(() => unmount());
    expect(wsInstances()[0].close).toHaveBeenCalled();
  });
});
