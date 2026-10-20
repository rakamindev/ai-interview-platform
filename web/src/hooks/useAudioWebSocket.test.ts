import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";

class FakeWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    static instances: FakeWebSocket[] = [];

    readyState: number = FakeWebSocket.CONNECTING;
    binaryType = "";
    sent: unknown[] = [];
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor(readonly url: string) {
        FakeWebSocket.instances.push(this);
    }

    send(data: unknown) {
        this.sent.push(data);
    }

    close() {
        this.readyState = FakeWebSocket.CLOSED;
        this.onclose?.();
    }

    open() {
        this.readyState = FakeWebSocket.OPEN;
        this.onopen?.();
    }

    receive(data: unknown) {
        this.onmessage?.({ data });
    }

    drop() {
        this.readyState = FakeWebSocket.CLOSED;
        this.onclose?.();
    }
}

function audioSocketCallbacks() {
    return {
        onAudioChunk: vi.fn(),
        onTranscript: vi.fn(),
        onStateChange: vi.fn(),
        onSpeakerChange: vi.fn(),
        onReconnected: vi.fn(),
    };
}

async function advance(ms: number) {
    await act(async () => {
        vi.advanceTimersByTime(ms);
    });
}

describe("useAudioWebSocket", () => {
    beforeEach(() => {
        FakeWebSocket.instances = [];
        vi.stubGlobal("WebSocket", FakeWebSocket);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function connectedSocket() {
        const callbacks = audioSocketCallbacks();
        const view = renderHook(() => useAudioWebSocket({ sessionId: 5, token: "tok", ...callbacks }));

        act(() => {
            view.result.current.connect();
        });

        const socket = FakeWebSocket.instances[0];
        return { ...view, callbacks, socket };
    }

    it("opens the session socket with the token and authenticates once connected", () => {
        const { result, socket } = connectedSocket();

        expect(socket.url).toContain("/ws/sessions/5/audio");
        expect(socket.url).toContain("token=tok");
        expect(result.current.connectionState).toBe("connecting");

        act(() => {
            socket.open();
        });

        expect(result.current.connectionState).toBe("connected");
        expect(socket.sent[0]).toBe(JSON.stringify({ type: "auth", token: "tok" }));
    });

    it("hands audio chunks to playback and announces the AI speaker once per turn", () => {
        const { callbacks, socket } = connectedSocket();

        const chunk = new ArrayBuffer(8);
        act(() => {
            socket.receive(chunk);
        });

        expect(callbacks.onAudioChunk).toHaveBeenCalledWith(chunk);
        expect(callbacks.onSpeakerChange).toHaveBeenCalledTimes(1);
        expect(callbacks.onSpeakerChange).toHaveBeenCalledWith("ai");

        act(() => {
            socket.receive(new ArrayBuffer(4));
        });
        expect(callbacks.onSpeakerChange).toHaveBeenCalledTimes(1);

        act(() => {
            socket.receive(JSON.stringify({ type: "speaker_changed", speaker: "candidate" }));
        });
        expect(callbacks.onSpeakerChange).toHaveBeenLastCalledWith("candidate");

        act(() => {
            socket.receive(new ArrayBuffer(4));
        });
        expect(callbacks.onSpeakerChange).toHaveBeenCalledTimes(3);
        expect(callbacks.onSpeakerChange).toHaveBeenLastCalledWith("ai");
    });

    it("routes control frames to the interview state and the transcript", () => {
        const { callbacks, socket } = connectedSocket();

        act(() => {
            socket.receive(JSON.stringify({ type: "session_started" }));
        });
        expect(callbacks.onStateChange).toHaveBeenLastCalledWith("active");

        act(() => {
            socket.receive(JSON.stringify({ type: "transcription", speaker: "candidate", text: "I led it." }));
        });
        expect(callbacks.onTranscript).toHaveBeenLastCalledWith({ speaker: "candidate", text: "I led it." });

        act(() => {
            socket.receive(JSON.stringify({ type: "transcription", speaker: "ai", text: "Go on." }));
        });
        expect(callbacks.onTranscript).toHaveBeenLastCalledWith({ speaker: "assessor", text: "Go on." });

        act(() => {
            socket.receive(JSON.stringify({ type: "preparing_to_end" }));
        });
        expect(callbacks.onStateChange).toHaveBeenLastCalledWith("draining_audio");

        act(() => {
            socket.receive(JSON.stringify({ type: "reconnected" }));
        });
        expect(callbacks.onStateChange).toHaveBeenLastCalledWith("active");
        expect(callbacks.onReconnected).toHaveBeenCalledTimes(1);
    });

    it("ignores text frames that are not control JSON", () => {
        const { callbacks, socket } = connectedSocket();

        act(() => {
            socket.receive("not-json");
        });

        expect(callbacks.onTranscript).not.toHaveBeenCalled();
        expect(callbacks.onStateChange).not.toHaveBeenCalled();
        expect(callbacks.onAudioChunk).not.toHaveBeenCalled();
    });

    it("sends audio and JSON only while the socket is open", () => {
        const { result, socket } = connectedSocket();

        act(() => {
            result.current.sendJson({ type: "ping" });
        });
        expect(socket.sent).toHaveLength(0);

        act(() => {
            socket.open();
        });
        act(() => {
            result.current.sendJson({ type: "ping" });
        });

        const audio = new ArrayBuffer(8);
        act(() => {
            result.current.send(audio);
        });

        expect(socket.sent).toContain(JSON.stringify({ type: "ping" }));
        expect(socket.sent).toContain(audio);
    });

    it("reconnects after an unexpected close and stops once the session ends", async () => {
        vi.useFakeTimers();
        const { callbacks, socket } = connectedSocket();

        act(() => {
            socket.open();
        });

        act(() => {
            socket.drop();
        });

        expect(callbacks.onStateChange).toHaveBeenLastCalledWith("reconnecting");

        await advance(1000);
        expect(FakeWebSocket.instances).toHaveLength(2);
        expect(FakeWebSocket.instances[1].url).toBe(socket.url);

        const second = FakeWebSocket.instances[1];
        act(() => {
            second.open();
        });
        act(() => {
            second.receive(JSON.stringify({ type: "session_ended" }));
        });

        expect(callbacks.onStateChange).toHaveBeenLastCalledWith("complete");

        act(() => {
            second.drop();
        });
        await advance(10000);
        expect(FakeWebSocket.instances).toHaveLength(2);
    });

    it("does not reconnect after unmount closes an unexpected socket", async () => {
        vi.useFakeTimers();
        const { socket, unmount } = connectedSocket();

        act(() => {
            socket.open();
        });
        unmount();
        await advance(5000);

        expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it("closes the socket when the component unmounts", () => {
        vi.useFakeTimers();
        const { socket, unmount } = connectedSocket();

        act(() => {
            socket.open();
        });
        expect(socket.readyState).toBe(FakeWebSocket.OPEN);

        unmount();

        expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
    });
});

