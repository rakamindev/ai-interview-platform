import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";

describe("useAudioPlayback (Gated Audio-Reactive Visualizer)", () => {
  let mockAudioContextClose: ReturnType<typeof vi.fn>;
  let createdBufferSource: any;
  let createdAnalyserNode: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockAudioContextClose = vi.fn().mockResolvedValue(undefined);

    class MockAudioContext {
      state = "running";
      currentTime = 0;
      destination = { name: "mockDestination" };

      createBuffer() {
        return {
          duration: 0.5,
          copyToChannel: vi.fn(),
        };
      }

      createBufferSource() {
        createdBufferSource = {
          buffer: null,
          connect: vi.fn(),
          start: vi.fn(),
        };
        return createdBufferSource;
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

    (window as any).AudioContext = MockAudioContext;
  });

  it("creates a persistent AnalyserNode connected to destination and exposes it", async () => {
    const { result } = renderHook(() => useAudioPlayback());

    expect(result.current.analyserNode).toBeNull();

    await act(async () => {
      await result.current.init();
    });

    expect(result.current.analyserNode).toBe(createdAnalyserNode);
    expect(createdAnalyserNode.connect).toHaveBeenCalledWith(
      expect.objectContaining({ name: "mockDestination" })
    );
  });

  it("connects dynamically scheduled buffer chunks into the analyserNode", async () => {
    const { result } = renderHook(() => useAudioPlayback());

    const dummyChunk = new Int16Array([0, 100, -100, 200]).buffer;

    await act(async () => {
      await result.current.playChunk(dummyChunk);
    });

    expect(createdBufferSource.connect).toHaveBeenCalledWith(createdAnalyserNode);
  });

  it("cleans up analyserNode and resets state on stop", async () => {
    const { result } = renderHook(() => useAudioPlayback());

    await act(async () => {
      await result.current.init();
    });

    expect(result.current.analyserNode).not.toBeNull();

    act(() => {
      result.current.stop();
    });

    expect(result.current.analyserNode).toBeNull();
    expect(mockAudioContextClose).toHaveBeenCalled();
  });
});
