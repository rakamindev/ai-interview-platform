import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioPlayback } from "./useAudioPlayback";
import { FakeAudioContext } from "@/test/audioFakes";

describe("AI playback", () => {
  beforeEach(() => {
    FakeAudioContext.reset();
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", FakeAudioContext);
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("converts PCM16 and schedules chunks without overlap", async () => {
    const { result } = renderHook(() => useAudioPlayback());
    await act(async () => {
      await result.current.playChunk(new Int16Array([-32768, 16384]).buffer);
      await result.current.playChunk(new Int16Array([8192, 0]).buffer);
    });
    const [first, second] = FakeAudioContext.instances[0].scheduled;
    expect(Array.from(first.samples)).toEqual([-1, 0.5]);
    expect(second.time).toBeCloseTo(first.time + 2 / 24000, 8);
    act(() => result.current.stop());
  });

  it("does not reopen the microphone after playback has stopped", async () => {
    const { result } = renderHook(() => useAudioPlayback());
    await act(async () => { await result.current.playChunk(new Int16Array(24000).buffer); });
    const reopenMicrophone = vi.fn();
    act(() => result.current.scheduleAfterPlayback(reopenMicrophone));
    act(() => result.current.stop());
    act(() => vi.advanceTimersByTime(1100));
    expect(reopenMicrophone).not.toHaveBeenCalled();
  });
});
