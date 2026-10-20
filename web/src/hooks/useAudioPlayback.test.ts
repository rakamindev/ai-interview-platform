import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";

interface FakeSource {
    buffer: { duration: number } | null;
    connect: Mock;
    start: Mock;
}

interface FakePlaybackContext {
    state: string;
    currentTime: number;
    destination: Record<string, never>;
    sampleRate: number;
    resume: Mock;
    close: Mock;
    createBuffer: Mock;
    createBufferSource: Mock;
    sources: FakeSource[];
}

function createPlaybackContext(): FakePlaybackContext {
    const sources: FakeSource[] = [];
    const ctx: FakePlaybackContext = {
        state: "running",
        currentTime: 0,
        destination: {},
        sampleRate: 24000,
        resume: vi.fn(async () => undefined),
        close: vi.fn(async () => {
            ctx.state = "closed";
        }),
        createBuffer: vi.fn((_channels: number, length: number, sampleRate: number) => ({
            duration: length / sampleRate,
            copyToChannel: vi.fn(),
        })),
        createBufferSource: vi.fn(() => {
            const source: FakeSource = { buffer: null, connect: vi.fn(), start: vi.fn() };
            sources.push(source);
            return source;
        }),
        sources,
    };

    return ctx;
}

function installPlaybackAudioContext() {
    const contexts: FakePlaybackContext[] = [];

    function AudioContextStub(this: unknown) {
        const ctx = createPlaybackContext();
        contexts.push(ctx);
        return ctx;
    }

    vi.stubGlobal("AudioContext", AudioContextStub);
    window.AudioContext = AudioContextStub as unknown as typeof window.AudioContext;

    return contexts;
}

async function advanceTimers(ms: number) {
    await act(async () => {
        vi.advanceTimersByTime(ms);
    });
}

describe("useAudioPlayback", () => {
    let contexts: FakePlaybackContext[];

    beforeEach(() => {
        contexts = installPlaybackAudioContext();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("queues each chunk after the previous one instead of overlapping them", async () => {
        const { result } = renderHook(() => useAudioPlayback());

        await act(async () => {
            await result.current.playChunk(new Int16Array([1, 2, 3, 4]).buffer);
        });
        await act(async () => {
            await result.current.playChunk(new Int16Array([5, 6, 7, 8]).buffer);
        });

        expect(contexts).toHaveLength(1);
        const [ctx] = contexts;
        expect(ctx.createBufferSource).toHaveBeenCalledTimes(2);

        const [first, second] = ctx.sources;
        expect(first.start).toHaveBeenCalledWith(0);
        expect(second.start).toHaveBeenCalledWith(first.buffer!.duration);
    });

    it("resumes a suspended context before scheduling audio", async () => {
        const { result } = renderHook(() => useAudioPlayback());

        await act(async () => {
            await result.current.playChunk(new Int16Array([1, 2]).buffer);
        });
        contexts[0].state = "suspended";
        await act(async () => {
            await result.current.playChunk(new Int16Array([3, 4]).buffer);
        });

        expect(contexts[0].resume).toHaveBeenCalledTimes(1);
        expect(contexts).toHaveLength(1);
    });

    it("reports drain only after the queued audio has finished playing", async () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useAudioPlayback());

        await act(async () => {
            await result.current.playChunk(new Int16Array([1, 2, 3, 4]).buffer);
        });

        const onDrained = vi.fn();
        act(() => {
            result.current.waitForDrain(onDrained);
        });

        await advanceTimers(750);
        expect(onDrained).not.toHaveBeenCalled();

        contexts[0].currentTime = 1;
        await advanceTimers(250);
        expect(onDrained).toHaveBeenCalledTimes(1);
    });

    it("calls back immediately when nothing is queued", () => {
        const { result } = renderHook(() => useAudioPlayback());
        const onDrained = vi.fn();

        act(() => {
            result.current.waitForDrain(onDrained);
        });

        expect(onDrained).toHaveBeenCalledTimes(1);
    });

    it("runs a follow-up only after the remaining queued audio", async () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useAudioPlayback());

        await act(async () => {
            await result.current.playChunk(new Int16Array([1, 2, 3, 4]).buffer);
        });

        const after = vi.fn();
        act(() => {
            result.current.scheduleAfterPlayback(after);
        });
        expect(after).not.toHaveBeenCalled();

        await advanceTimers(1);
        expect(after).toHaveBeenCalledTimes(1);
    });

    it("closes the context and clears the queue on reset", async () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useAudioPlayback());

        await act(async () => {
            await result.current.playChunk(new Int16Array([1, 2, 3, 4]).buffer);
        });
        expect(contexts).toHaveLength(1);

        const onDrained = vi.fn();
        act(() => {
            result.current.waitForDrain(onDrained);
        });
        expect(onDrained).not.toHaveBeenCalled();

        act(() => {
            result.current.stop();
        });

        expect(contexts[0].close).toHaveBeenCalledTimes(1);

        // The queue is empty after a reset, so a later drain check resolves at once.
        const afterStop = vi.fn();
        act(() => {
            result.current.waitForDrain(afterStop);
        });
        expect(afterStop).toHaveBeenCalledTimes(1);

        await advanceTimers(1000);
        expect(onDrained).not.toHaveBeenCalled();

        // Playback starts again on a fresh context.
        await act(async () => {
            await result.current.playChunk(new Int16Array([1, 2]).buffer);
        });
        expect(contexts).toHaveLength(2);
    });
});
