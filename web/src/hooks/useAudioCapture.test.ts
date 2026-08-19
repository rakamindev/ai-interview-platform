import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { renderHook, act } from "@testing-library/react";
import { useAudioCapture } from "./useAudioCapture";

const nodeInstances: Array<{
  port: {
    onmessage: ((e: { data: ArrayBuffer }) => void) | null;
    postMessage: ReturnType<typeof vi.fn>;
  };
  disconnect: ReturnType<typeof vi.fn>;
}> = [];

class CapturingAudioWorkletNode {
  port: { onmessage: unknown; postMessage: ReturnType<typeof vi.fn> };
  disconnect = vi.fn();

  constructor(_context: unknown, _name: string) {
    this.port = { onmessage: null, postMessage: vi.fn() };
    nodeInstances.push(this as never);
  }
}

describe("useAudioCapture", () => {
  beforeEach(() => {
    nodeInstances.length = 0;
    vi.stubGlobal("AudioWorkletNode", CapturingAudioWorkletNode);
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockClear();
    (
      globalThis as unknown as {
        AudioContext: { instances: Array<unknown> };
      }
    ).AudioContext.instances.length = 0;
  });

  it("starts capture: requests the mic, wires the worklet and flips isCapturing", async () => {
    const getUserMedia = vi.spyOn(navigator.mediaDevices, "getUserMedia");
    const onFrame = vi.fn();
    const { result } = renderHook(() => useAudioCapture({ onFrame }));

    await act(() => result.current.start());

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    expect(result.current.isCapturing).toBe(true);
    expect(nodeInstances).toHaveLength(1);
    expect(nodeInstances[0].port.onmessage).toBeTypeOf("function");
  });

  it("does not start twice while already capturing", async () => {
    const getUserMedia = vi.spyOn(navigator.mediaDevices, "getUserMedia");
    const { result } = renderHook(() => useAudioCapture({ onFrame: vi.fn() }));

    await act(() => result.current.start());
    await act(() => result.current.start());

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(nodeInstances).toHaveLength(1);
  });

  it("reports errors from getUserMedia without capturing", async () => {
    vi.spyOn(navigator.mediaDevices, "getUserMedia").mockRejectedValueOnce(new Error("denied"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onError = vi.fn();
    const { result } = renderHook(() => useAudioCapture({ onFrame: vi.fn(), onError }));

    await act(() => result.current.start());

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(result.current.isCapturing).toBe(false);
    consoleSpy.mockRestore();
  });

  it("forwards frames only while unmuted", async () => {
    const onFrame = vi.fn();
    const { result } = renderHook(() => useAudioCapture({ onFrame }));

    await act(() => result.current.start());

    const frame = new ArrayBuffer(4);
    act(() => {
      nodeInstances[0].port.onmessage?.({ data: frame });
    });
    expect(onFrame).toHaveBeenCalledWith(frame);

    act(() => result.current.mute());
    act(() => {
      nodeInstances[0].port.onmessage?.({ data: frame });
    });
    expect(onFrame).toHaveBeenCalledTimes(1);

    act(() => result.current.unmute());
    act(() => {
      nodeInstances[0].port.onmessage?.({ data: frame });
    });
    expect(onFrame).toHaveBeenCalledTimes(2);
  });

  it("stops capture: disconnects the worklet, closes the context and releases tracks", async () => {
    const { result } = renderHook(() => useAudioCapture({ onFrame: vi.fn() }));

    await act(() => result.current.start());
    const ctx = (globalThis as unknown as { AudioContext: { instances: Array<{ state: string }> } })
      .AudioContext.instances[0];
    act(() => result.current.stop());

    expect(result.current.isCapturing).toBe(false);
    expect(nodeInstances[0].disconnect).toHaveBeenCalled();
    expect(ctx.state).toBe("closed");
  });
});
