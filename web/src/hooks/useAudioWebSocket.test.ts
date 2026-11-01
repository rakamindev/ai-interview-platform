import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readyState = 0;
  binaryType = "";
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  serverOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  serverSend(payload: object) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  serverClose() {
    this.readyState = 3;
    this.onclose?.();
  }
}

const latestSocket = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1];

function setup() {
  const onStateChange = vi.fn();
  const onSessionFailed = vi.fn();
  const { result } = renderHook(() =>
    useAudioWebSocket({
      sessionId: 3,
      token: "invite-token",
      clientId: "a".repeat(32),
      onAudioChunk: vi.fn(),
      onTranscript: vi.fn(),
      onStateChange,
      onSpeakerChange: vi.fn(),
      onSessionFailed,
    }),
  );
  act(() => result.current.connect());
  return { result, onStateChange, onSessionFailed };
}

describe("useAudioWebSocket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("stops reconnecting when the backend rejects the session", () => {
    const { onStateChange, onSessionFailed } = setup();

    act(() => {
      latestSocket().serverOpen();
      latestSocket().serverSend({
        type: "error",
        code: "auth_failed",
        message: "Session has ended",
        recoverable: false,
      });
      latestSocket().serverClose();
    });
    act(() => vi.advanceTimersByTime(30_000));

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(onSessionFailed).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenLastCalledWith("complete");
    expect(onStateChange).not.toHaveBeenCalledWith("reconnecting");
  });

  it("identifies this browser to the backend when connecting with an invite token", () => {
    setup();

    expect(latestSocket().url).toContain(`?token=invite-token&client_id=${"a".repeat(32)}`);
  });

  it("URL-encodes the invite token in the socket URL", () => {
    renderHook(() =>
      useAudioWebSocket({
        sessionId: 3,
        token: "a b&c=d",
        clientId: "a".repeat(32),
        onAudioChunk: vi.fn(),
        onTranscript: vi.fn(),
        onStateChange: vi.fn(),
        onSpeakerChange: vi.fn(),
      }),
    ).result.current.connect();

    expect(latestSocket().url).toContain("?token=a%20b%26c%3Dd&client_id=");
  });

  it("stops and reports session_in_use when another browser already started the interview", () => {
    const { onStateChange, onSessionFailed } = setup();

    act(() => {
      latestSocket().serverOpen();
      latestSocket().serverSend({
        type: "error",
        code: "session_in_use",
        message: "Interview already in progress in another browser",
        recoverable: false,
      });
      latestSocket().serverClose();
    });
    act(() => vi.advanceTimersByTime(30_000));

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(onSessionFailed).toHaveBeenCalledWith("session_in_use");
    expect(onStateChange).toHaveBeenLastCalledWith("complete");
  });

  it("stops without retrying and reports claim_unavailable when the claim cannot be verified", () => {
    const { onStateChange, onSessionFailed } = setup();

    act(() => {
      latestSocket().serverOpen();
      latestSocket().serverSend({
        type: "error",
        code: "claim_unavailable",
        message: "Interview service is temporarily unavailable",
        recoverable: false,
      });
      latestSocket().serverClose();
    });
    // Past the whole retry schedule (1s + 2s + 4s).
    act(() => vi.advanceTimersByTime(30_000));

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(onSessionFailed).toHaveBeenCalledTimes(1);
    expect(onSessionFailed).toHaveBeenCalledWith("claim_unavailable");
    expect(onStateChange).not.toHaveBeenCalledWith("reconnecting");
    expect(onStateChange).toHaveBeenLastCalledWith("complete");
  });

  it("gives up after the retry budget when sockets open but the session never starts", () => {
    const { onStateChange, onSessionFailed } = setup();

    for (let i = 0; i < 4; i += 1) {
      act(() => {
        latestSocket().serverOpen();
        latestSocket().serverClose();
      });
      act(() => vi.advanceTimersByTime(5_000));
    }
    act(() => vi.advanceTimersByTime(30_000));

    // Initial socket + 3 retries, then no more.
    expect(FakeWebSocket.instances).toHaveLength(4);
    expect(onSessionFailed).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenLastCalledWith("complete");
  });

  it("keeps reconnecting after transient drops once the session is live", () => {
    const { onStateChange, onSessionFailed } = setup();

    for (let i = 0; i < 5; i += 1) {
      act(() => {
        latestSocket().serverOpen();
        latestSocket().serverSend({ type: "session_started" });
        latestSocket().serverClose();
      });
      expect(onStateChange).toHaveBeenLastCalledWith("reconnecting");
      act(() => vi.advanceTimersByTime(1_000));
    }

    expect(FakeWebSocket.instances).toHaveLength(6);
    expect(onSessionFailed).not.toHaveBeenCalled();
  });

  it("reports a failure when the backend ends the session with an error", () => {
    const { onStateChange, onSessionFailed } = setup();

    act(() => {
      latestSocket().serverOpen();
      latestSocket().serverSend({ type: "session_ended", reason: "error" });
      latestSocket().serverClose();
    });

    expect(onSessionFailed).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenLastCalledWith("complete");
  });

  it("does not report a failure when the session ends normally", () => {
    const { onSessionFailed } = setup();

    act(() => {
      latestSocket().serverOpen();
      latestSocket().serverSend({ type: "session_ended", reason: "time_ceiling" });
      latestSocket().serverClose();
    });

    expect(onSessionFailed).not.toHaveBeenCalled();
  });

  it("does not reconnect or report a failure after an intentional disconnect", () => {
    const { result, onStateChange, onSessionFailed } = setup();

    act(() => {
      latestSocket().serverOpen();
      latestSocket().serverSend({ type: "session_started" });
    });
    act(() => result.current.disconnect());
    act(() => vi.advanceTimersByTime(30_000));

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(onSessionFailed).not.toHaveBeenCalled();
    expect(onStateChange).not.toHaveBeenCalledWith("reconnecting");
  });
});
