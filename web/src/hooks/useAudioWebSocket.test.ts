import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useAudioWebSocket } from "./useAudioWebSocket";
import type { InterviewState } from "@/types";

/** Minimal WebSocket double driven manually by the tests. */
class FakeWebSocket {
    static instances: FakeWebSocket[] = [];
    static OPEN = 1;
    readyState = 0;
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onerror: (() => void) | null = null;
    onclose: (() => void) | null = null;

    constructor(public url: string) {
        FakeWebSocket.instances.push(this);
    }

    send() {}
    close() {
        this.readyState = 3;
    }

    open() {
        this.readyState = FakeWebSocket.OPEN;
        this.onopen?.();
    }
    drop() {
        this.readyState = 3;
        this.onclose?.();
    }
    message(payload: object) {
        this.onmessage?.({ data: JSON.stringify(payload) });
    }
}

function renderSocket(onStateChange: (state: InterviewState) => void) {
    return renderHook(() =>
        useAudioWebSocket({
            sessionId: 5,
            token: "test-token",
            onAudioChunk: vi.fn(),
            onTranscript: vi.fn(),
            onStateChange,
            onSpeakerChange: vi.fn(),
        })
    );
}

beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
    vi.useFakeTimers();
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("useAudioWebSocket reconnect behaviour", () => {
    it("reports a lost connection, not completion, when reconnects are exhausted", () => {
        const onStateChange = vi.fn();
        const { result } = renderSocket(onStateChange);

        act(() => result.current.connect());
        act(() => FakeWebSocket.instances[0].open());

        // Initial drop, then each scheduled retry drops again (1s, 2s, 4s).
        act(() => FakeWebSocket.instances[0].drop());
        for (const delay of [1000, 2000, 4000]) {
            act(() => vi.advanceTimersByTime(delay));
            act(() => FakeWebSocket.instances[FakeWebSocket.instances.length - 1].drop());
        }

        expect(onStateChange).toHaveBeenCalledWith("reconnecting");
        expect(onStateChange).not.toHaveBeenCalledWith("complete");
        expect(onStateChange).toHaveBeenLastCalledWith("connection_lost");
    });

    it("reports completion when the server ends the session, without reconnecting", () => {
        const onStateChange = vi.fn();
        const { result } = renderSocket(onStateChange);

        act(() => result.current.connect());
        act(() => FakeWebSocket.instances[0].open());
        act(() => FakeWebSocket.instances[0].message({ type: "session_ended", reason: "all_covered" }));
        act(() => FakeWebSocket.instances[0].drop());
        act(() => vi.advanceTimersByTime(10_000));

        expect(onStateChange).toHaveBeenCalledWith("complete");
        expect(onStateChange).not.toHaveBeenCalledWith("connection_lost");
        expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it("reports a lost connection on unrecoverable server errors", () => {
        const onStateChange = vi.fn();
        const { result } = renderSocket(onStateChange);

        act(() => result.current.connect());
        act(() => FakeWebSocket.instances[0].open());
        act(() =>
            FakeWebSocket.instances[0].message({
                type: "error",
                code: "auth_failed",
                message: "Authentication failed",
                recoverable: false,
            })
        );

        expect(onStateChange).toHaveBeenLastCalledWith("connection_lost");
        expect(onStateChange).not.toHaveBeenCalledWith("complete");
    });
});
