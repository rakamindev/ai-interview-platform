import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";

class MockAudioBuffer {
  channels: Float32Array[] = [];
  duration: number;
  length: number;
  sampleRate: number;

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    for (let i = 0; i < numberOfChannels; i++) {
      this.channels.push(new Float32Array(length));
    }
  }

  copyToChannel(source: Float32Array, channelNumber: number) {
    if (this.channels[channelNumber]) {
      this.channels[channelNumber].set(source);
    }
  }
}

class MockAudioBufferSourceNode {
  buffer: MockAudioBuffer | null = null;
  startedAt: number | null = null;

  connect() {}

  start(when: number) {
    this.startedAt = when;
  }
}

class MockAudioContext {
  static instances: MockAudioContext[] = [];
  state: string = "running";
  currentTime: number = 0;
  sampleRate: number;
  destination: object = {};
  createdSources: MockAudioBufferSourceNode[] = [];
  createdBuffers: MockAudioBuffer[] = [];

  constructor(options?: { sampleRate?: number }) {
    this.sampleRate = options?.sampleRate ?? 24000;
    MockAudioContext.instances.push(this);
  }

  async resume() {
    this.state = "running";
  }

  async close() {
    this.state = "closed";
  }

  createBuffer(numberOfChannels: number, length: number, sampleRate: number) {
    const buffer = new MockAudioBuffer(numberOfChannels, length, sampleRate);
    this.createdBuffers.push(buffer);
    return buffer;
  }

  createBufferSource() {
    const source = new MockAudioBufferSourceNode();
    this.createdSources.push(source);
    return source;
  }
}

describe("useAudioPlayback Hook", () => {
  const originalAudioContext = globalThis.AudioContext;

  beforeEach(() => {
    vi.useFakeTimers();
    MockAudioContext.instances = [];
    vi.stubGlobal("AudioContext", MockAudioContext);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.stubGlobal("AudioContext", originalAudioContext);
  });

  it("converts raw PCM Int16 samples to Float32 and plays through AudioContext", async () => {
    const { result } = renderHook(() => useAudioPlayback());

    const int16Samples = new Int16Array([0, 16384, -16384, 32767]);
    await act(async () => {
      await result.current.playChunk(int16Samples.buffer);
    });

    expect(MockAudioContext.instances.length).toBe(1);
    const ctx = MockAudioContext.instances[0];
    expect(ctx.createdBuffers.length).toBe(1);
    expect(ctx.createdSources.length).toBe(1);

    const buffer = ctx.createdBuffers[0];
    const channelData = buffer.channels[0];
    expect(channelData[0]).toBe(0);
    expect(channelData[1]).toBeCloseTo(0.5, 2);
    expect(channelData[2]).toBeCloseTo(-0.5, 2);
    expect(channelData[3]).toBeCloseTo(1.0, 2);
  });

  it("triggers drain callback immediately if queue is empty", () => {
    const { result } = renderHook(() => useAudioPlayback());
    const onDrain = vi.fn();

    act(() => {
      result.current.waitForDrain(onDrain);
    });

    expect(onDrain).toHaveBeenCalledTimes(1);
  });

  it("triggers drain callback after playback queue elapses", async () => {
    const { result } = renderHook(() => useAudioPlayback());
    const onDrain = vi.fn();

    const sampleRate = 24000;
    const int16Samples = new Int16Array(sampleRate);
    await act(async () => {
      await result.current.playChunk(int16Samples.buffer);
    });

    act(() => {
      result.current.waitForDrain(onDrain);
    });

    expect(onDrain).not.toHaveBeenCalled();

    const ctx = MockAudioContext.instances[0];
    ctx.currentTime = 1.1;

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(onDrain).toHaveBeenCalledTimes(1);
  });

  it("closes AudioContext and resets timeline on stop", async () => {
    const { result } = renderHook(() => useAudioPlayback());

    const int16Samples = new Int16Array(100);
    await act(async () => {
      await result.current.playChunk(int16Samples.buffer);
    });

    const ctx = MockAudioContext.instances[0];
    expect(ctx.state).toBe("running");

    act(() => {
      result.current.stop();
    });

    expect(ctx.state).toBe("closed");
  });
});
