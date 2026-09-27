import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAudioWebSocket } from "./useAudioWebSocket";

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
        this.onclose?.();
    }

    receive(message: object) {
        this.onmessage?.({ data: JSON.stringify(message) });
    }
}

function renderSocketHook() {
    const onStateChange = vi.fn();
    const onFatalError = vi.fn();
    const { result } = renderHook(() =>
        useAudioWebSocket({
            sessionId: 1,
            token: "test-token",
            onAudioChunk: vi.fn(),
            onTranscript: vi.fn(),
            onStateChange,
            onSpeakerChange: vi.fn(),
            onFatalError,
        }),
    );
    act(() => result.current.connect());
    return { onStateChange, onFatalError };
}

describe("useAudioWebSocket", () => {
    beforeEach(() => {
        FakeWebSocket.instances = [];
        vi.stubGlobal("WebSocket", FakeWebSocket);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("does not reconnect after a non-recoverable error and reports it as failed", () => {
        const { onStateChange, onFatalError } = renderSocketHook();
        const socket = FakeWebSocket.instances[0];

        act(() => {
            socket.receive({ type: "error", code: "assessment_invalid", recoverable: false, message: "Please contact the person who invited you." });
            socket.close();
            vi.advanceTimersByTime(10_000);
        });

        expect(FakeWebSocket.instances).toHaveLength(1);
        expect(onStateChange).toHaveBeenLastCalledWith("failed");
        expect(onStateChange).not.toHaveBeenCalledWith("reconnecting");
        expect(onFatalError).toHaveBeenCalledWith("Please contact the person who invited you.");
    });

    it("reports a lost connection as failed, not complete, once reconnect attempts run out", () => {
        const { onStateChange, onFatalError } = renderSocketHook();

        act(() => {
            for (const delay of [1_000, 2_000, 4_000]) {
                FakeWebSocket.instances[FakeWebSocket.instances.length - 1].close();
                vi.advanceTimersByTime(delay);
            }
            FakeWebSocket.instances[FakeWebSocket.instances.length - 1].close();
        });

        expect(FakeWebSocket.instances).toHaveLength(4);
        expect(onStateChange).toHaveBeenLastCalledWith("failed");
        expect(onStateChange).not.toHaveBeenCalledWith("complete");
        expect(onFatalError).toHaveBeenCalledWith(
            "The connection to your interview was lost. Refresh this page to try again, or contact the person who invited you.",
        );
    });

    it("still reconnects after an unexpected drop", () => {
        const { onStateChange } = renderSocketHook();

        act(() => {
            FakeWebSocket.instances[0].close();
            vi.advanceTimersByTime(1_000);
        });

        expect(onStateChange).toHaveBeenCalledWith("reconnecting");
        expect(FakeWebSocket.instances).toHaveLength(2);
    });
});
