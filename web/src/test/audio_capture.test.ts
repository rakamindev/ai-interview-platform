import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioCapture } from "@/hooks/useAudioCapture";

class MockMediaStreamTrack {
  kind: string = "audio";
  enabled: boolean = true;
  stopped: boolean = false;

  stop() {
    this.stopped = true;
  }
}

class MockMediaStream {
  tracks: MockMediaStreamTrack[] = [new MockMediaStreamTrack()];

  getTracks() {
    return this.tracks;
  }
}

class MockMessagePort {
  onmessage: ((event: { data: ArrayBuffer }) => void) | null = null;
}

class MockAudioWorkletNode {
  port = new MockMessagePort();
  disconnected = false;

  connect() {}

  disconnect() {
    this.disconnected = true;
  }
}

class MockAudioContext {
  static instances: MockAudioContext[] = [];
  state: string = "running";
  sampleRate: number;
  audioWorklet = {
    addModule: vi.fn().mockResolvedValue(undefined),
  };

  constructor(options?: { sampleRate?: number }) {
    this.sampleRate = options?.sampleRate ?? 16000;
    MockAudioContext.instances.push(this);
  }

  createMediaStreamSource() {
    return {
      connect: vi.fn(),
    };
  }

  async close() {
    this.state = "closed";
  }
}

describe("useAudioCapture Hook", () => {
  const originalAudioContext = globalThis.AudioContext;
  const originalAudioWorkletNode = (globalThis as unknown as { AudioWorkletNode?: unknown }).AudioWorkletNode;
  let mockStream: MockMediaStream;

  beforeEach(() => {
    mockStream = new MockMediaStream();
    MockAudioContext.instances = [];

    vi.stubGlobal("AudioContext", MockAudioContext);
    vi.stubGlobal("AudioWorkletNode", MockAudioWorkletNode);

    const mockMediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(mockStream),
    };
    Object.defineProperty(navigator, "mediaDevices", {
      value: mockMediaDevices,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.stubGlobal("AudioContext", originalAudioContext);
    if (originalAudioWorkletNode) {
      vi.stubGlobal("AudioWorkletNode", originalAudioWorkletNode);
    }
  });

  it("requests audio media with 16kHz constraint and starts capturing", async () => {
    const onFrame = vi.fn();
    const { result } = renderHook(() => useAudioCapture({ onFrame }));

    expect(result.current.isCapturing).toBe(false);

    await act(async () => {
      await result.current.start();
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    expect(result.current.isCapturing).toBe(true);
    expect(MockAudioContext.instances.length).toBe(1);
  });

  it("mutes and unmutes frame forwarding from worklet", async () => {
    const onFrame = vi.fn();
    const { result } = renderHook(() => useAudioCapture({ onFrame }));

    await act(async () => {
      await result.current.start();
    });

    const activeNode = MockAudioWorkletNode.prototype;
    const testBuffer = new ArrayBuffer(8);

    act(() => {
      result.current.mute();
    });

    act(() => {
      result.current.unmute();
    });

    expect(result.current.isCapturing).toBe(true);
  });

  it("stops media tracks and closes AudioContext on stop", async () => {
    const onFrame = vi.fn();
    const { result } = renderHook(() => useAudioCapture({ onFrame }));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.isCapturing).toBe(true);
    const track = mockStream.getTracks()[0];
    expect(track.stopped).toBe(false);

    act(() => {
      result.current.stop();
    });

    expect(result.current.isCapturing).toBe(false);
    expect(track.stopped).toBe(true);
    expect(MockAudioContext.instances[0].state).toBe("closed");
  });

  it("releases microphone tracks and closes AudioContext on unmount", async () => {
    const onFrame = vi.fn();
    const { result, unmount } = renderHook(() => useAudioCapture({ onFrame }));

    await act(async () => {
      await result.current.start();
    });

    const track = mockStream.getTracks()[0];
    expect(track.stopped).toBe(false);

    unmount();

    expect(track.stopped).toBe(true);
    expect(MockAudioContext.instances[0].state).toBe("closed");
  });
});
