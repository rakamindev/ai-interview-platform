import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioCapture } from "@/hooks/useAudioCapture";

describe("useAudioCapture (Gated Audio-Reactive Visualizer)", () => {
  let mockTrackStop: ReturnType<typeof vi.fn>;
  let mockStream: any;
  let mockAudioContextClose: ReturnType<typeof vi.fn>;
  let mockGainSetValueAtTime: ReturnType<typeof vi.fn>;
  let createdGainNode: any;
  let createdAnalyserNode: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockTrackStop = vi.fn();
    mockStream = {
      getTracks: vi.fn(() => [{ stop: mockTrackStop }]),
    };
    mockAudioContextClose = vi.fn().mockResolvedValue(undefined);
    mockGainSetValueAtTime = vi.fn();

    Object.defineProperty(navigator, "mediaDevices", {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });

    class MockAudioContext {
      state = "running";
      currentTime = 5.0;
      destination = {};
      audioWorklet = {
        addModule: vi.fn().mockResolvedValue(undefined),
      };
      createGain() {
        createdGainNode = {
          connect: vi.fn(),
          disconnect: vi.fn(),
          gain: { setValueAtTime: mockGainSetValueAtTime, value: 1 },
        };
        return createdGainNode;
      }
      createMediaStreamSource() {
        return {
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
      }
      createAnalyser() {
        createdAnalyserNode = {
          fftSize: 256,
          frequencyBinCount: 128,
          connect: vi.fn(),
          disconnect: vi.fn(),
          getByteFrequencyData: vi.fn(),
        };
        return createdAnalyserNode;
      }
      resume = vi.fn().mockResolvedValue(undefined);
      close = mockAudioContextClose;
    }

    class MockAudioWorkletNode {
      port = { onmessage: null as any };
      connect = vi.fn();
      disconnect = vi.fn();
    }

    (window as any).AudioContext = MockAudioContext;
    (window as any).AudioWorkletNode = MockAudioWorkletNode;
  });

  it("creates a gated visualizer gain branch and exposes analyserNode upon start", async () => {
    const { result } = renderHook(() => useAudioCapture({ onFrame: vi.fn() }));

    expect(result.current.analyserNode).toBeNull();

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.isCapturing).toBe(true);
    expect(result.current.analyserNode).toBe(createdAnalyserNode);
  });

  it("gates visualizer gain to 0 on mute and restores to 1 on unmute", async () => {
    const { result } = renderHook(() => useAudioCapture({ onFrame: vi.fn() }));

    await act(async () => {
      await result.current.start();
    });

    // Mute should set gain to 0
    act(() => {
      result.current.mute();
    });
    expect(mockGainSetValueAtTime).toHaveBeenCalledWith(0, 5.0);

    // Unmute should set gain to 1
    act(() => {
      result.current.unmute();
    });
    expect(mockGainSetValueAtTime).toHaveBeenCalledWith(1, 5.0);
  });

  it("cleans up analyserNode and contexts on stop", async () => {
    const { result } = renderHook(() => useAudioCapture({ onFrame: vi.fn() }));

    await act(async () => {
      await result.current.start();
    });

    act(() => {
      result.current.stop();
    });

    expect(result.current.isCapturing).toBe(false);
    expect(result.current.analyserNode).toBeNull();
    expect(mockAudioContextClose).toHaveBeenCalled();
    expect(mockTrackStop).toHaveBeenCalled();
  });
});
