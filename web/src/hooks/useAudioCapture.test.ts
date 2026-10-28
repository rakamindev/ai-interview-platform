import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioCapture } from "./useAudioCapture";
import { FakeAudioContext, FakeWorklet } from "@/test/audioFakes";

describe("microphone capture", () => {
  const track = { stop: vi.fn() };

  beforeEach(() => {
    FakeAudioContext.reset();
    vi.useFakeTimers();
    track.stop.mockClear();
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("AudioWorkletNode", FakeWorklet);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) },
    });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("reports input activity from PCM energy and clears it when frames stop", async () => {
    const { result } = renderHook(() => useAudioCapture({ onFrame: () => {} }));
    await act(async () => { await result.current.start(); });
    expect(result.current.hasInputAudio).toBe(false);
    act(() => FakeWorklet.instances[0].emit(new Int16Array([1000, -1000])));
    expect(result.current.hasInputAudio).toBe(true);
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.hasInputAudio).toBe(false);
    act(() => result.current.stop());
  });

  it("clears input activity when the candidate mutes the microphone", async () => {
    const { result } = renderHook(() => useAudioCapture({ onFrame: () => {} }));
    await act(async () => { await result.current.start(); });
    act(() => FakeWorklet.instances[0].emit(new Int16Array([2000, -2000])));
    expect(result.current.hasInputAudio).toBe(true);
    act(() => result.current.mute());
    expect(result.current.hasInputAudio).toBe(false);
    act(() => result.current.stop());
  });

  it("resumes a suspended context and forwards PCM through an active graph", async () => {
    FakeAudioContext.startSuspended = true;
    const frames: ArrayBuffer[] = [];
    const { result } = renderHook(() => useAudioCapture({ onFrame: (frame) => frames.push(frame) }));
    await act(async () => { await result.current.start(); });
    act(() => FakeWorklet.instances[0].emit(new Int16Array([1024, -1024])));
    expect(frames.map((frame) => Array.from(new Int16Array(frame)))).toEqual([[1024, -1024]]);
    act(() => result.current.stop());
  });

  it("keeps the candidate muted during AI speech and forwards the next turn", async () => {
    const frames: ArrayBuffer[] = [];
    const { result } = renderHook(() => useAudioCapture({ onFrame: (frame) => frames.push(frame) }));
    act(() => result.current.mute());
    await act(async () => { await result.current.start(); });
    act(() => FakeWorklet.instances[0].emit(new Int16Array([100])));
    expect(frames).toHaveLength(0);
    act(() => result.current.unmute());
    act(() => FakeWorklet.instances[0].emit(new Int16Array([200])));
    expect(frames.map((frame) => Array.from(new Int16Array(frame)))).toEqual([[200]]);
    act(() => result.current.stop());
  });

  it("releases the microphone when loading the worklet fails", async () => {
    FakeAudioContext.moduleError = new Error("worklet unavailable");
    const onError = vi.fn();
    const { result } = renderHook(() => useAudioCapture({ onFrame: () => {}, onError }));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => { await result.current.start(); });
    expect(track.stop).toHaveBeenCalledOnce();
    expect(FakeAudioContext.instances[0].state).toBe("closed");
    expect(result.current.isCapturing).toBe(false);
    expect(onError).toHaveBeenCalledWith(FakeAudioContext.moduleError);
    consoleError.mockRestore();
  });

  it("releases audio resources when the page unmounts", async () => {
    const { result, unmount } = renderHook(() => useAudioCapture({ onFrame: () => {} }));
    await act(async () => { await result.current.start(); });
    unmount();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(FakeAudioContext.instances[0].state).toBe("closed");
  });
});
