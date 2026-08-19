import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { renderHook, act } from "@testing-library/react";
import { useAudioPlayback } from "./useAudioPlayback";

function pcmChunk(samples: number[]): ArrayBuffer {
  return Int16Array.from(samples).buffer;
}

function firstContext() {
  return (
    globalThis as unknown as {
      AudioContext: {
        instances: Array<{
          state: string;
          currentTime: number;
          destination: unknown;
          resume: ReturnType<typeof vi.fn>;
          createBuffer: ReturnType<typeof vi.fn>;
          createBufferSource: ReturnType<typeof vi.fn>;
        }>;
      };
    }
  ).AudioContext.instances[0];
}

describe("useAudioPlayback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const AC = globalThis as unknown as {
      AudioContext: {
        instances: Array<unknown>;
        prototype: {
          createBuffer: ReturnType<typeof vi.fn>;
          createBufferSource: ReturnType<typeof vi.fn>;
          resume: ReturnType<typeof vi.fn>;
        };
      };
    };
    AC.AudioContext.instances.length = 0;
    vi.spyOn(AC.AudioContext.prototype, "createBuffer").mockClear();
    vi.spyOn(AC.AudioContext.prototype, "createBufferSource").mockClear();
    vi.spyOn(AC.AudioContext.prototype, "resume").mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("decodes Int16 PCM into a scheduled buffer at 24kHz", async () => {
    const { result } = renderHook(() => useAudioPlayback());

    await act(() => result.current.playChunk(pcmChunk([1000, -2000])));

    const ctx = firstContext();
    expect(ctx).toBeDefined();
    expect(ctx.createBuffer).toHaveBeenCalledWith(1, 2, 24000);
    const source = (ctx.createBufferSource as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(source.connect).toHaveBeenCalledWith(ctx.destination);
    expect(source.start).toHaveBeenCalledWith(0);
  });

  it("resumes a suspended context before scheduling", async () => {
    const { result } = renderHook(() => useAudioPlayback());
    await act(() => result.current.playChunk(pcmChunk([1, 2])));

    const ctx = firstContext();
    ctx.state = "suspended";
    await act(() => result.current.playChunk(pcmChunk([3, 4])));

    expect(ctx.resume).toHaveBeenCalled();
    expect(ctx.state).toBe("running");
  });

  it("queues chunks back-to-back using the playhead", async () => {
    const { result } = renderHook(() => useAudioPlayback());
    await act(() => result.current.playChunk(pcmChunk([1, 2])));
    await act(() => result.current.playChunk(pcmChunk([3, 4])));

    const ctx = firstContext();
    const sourceStarts = (ctx.createBufferSource as ReturnType<typeof vi.fn>).mock.results.map(
      (r) => r.value.start.mock.calls[0][0],
    );
    expect(sourceStarts[0]).toBe(0);
    expect(sourceStarts[1]).toBeCloseTo(2 / 24000, 10);
  });

  it("calls the drain callback immediately when nothing is queued", async () => {
    const { result } = renderHook(() => useAudioPlayback());
    const fn = vi.fn();
    act(() => result.current.waitForDrain(fn));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("polls until the queue drains then fires the callback", async () => {
    const { result } = renderHook(() => useAudioPlayback());
    await act(() => result.current.playChunk(pcmChunk([1, 2])));

    const fn = vi.fn();
    act(() => result.current.waitForDrain(fn));
    expect(fn).not.toHaveBeenCalled();

    const ctx = firstContext();
    ctx.currentTime = 1;
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("cancelDrain prevents a pending callback from firing", async () => {
    const { result } = renderHook(() => useAudioPlayback());
    await act(() => result.current.playChunk(pcmChunk([1, 2])));

    const fn = vi.fn();
    act(() => result.current.waitForDrain(fn));
    act(() => result.current.cancelDrain());
    firstContext().currentTime = 1;
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it("scheduleAfterPlayback runs immediately without a context or an empty queue", () => {
    const { result } = renderHook(() => useAudioPlayback());
    const fn = vi.fn();
    act(() => result.current.scheduleAfterPlayback(fn));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("scheduleAfterPlayback delays the callback until the queue drains", async () => {
    const { result } = renderHook(() => useAudioPlayback());
    await act(() => result.current.playChunk(pcmChunk([1, 2])));

    const fn = vi.fn();
    act(() => result.current.scheduleAfterPlayback(fn));
    expect(fn).not.toHaveBeenCalled();

    firstContext().currentTime = 1;
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("stop closes the context and resets the playhead", async () => {
    const { result } = renderHook(() => useAudioPlayback());
    await act(() => result.current.playChunk(pcmChunk([1, 2])));
    const ctx = firstContext();

    act(() => result.current.stop());
    expect(ctx.state).toBe("closed");

    const fn = vi.fn();
    act(() => result.current.scheduleAfterPlayback(fn));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
