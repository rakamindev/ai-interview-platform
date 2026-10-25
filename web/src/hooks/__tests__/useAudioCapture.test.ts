import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import type { AudioCaptureStartResult, VerifiedMicrophone } from "@/types/audio";

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  static addModule = vi.fn().mockResolvedValue(undefined);
  state = "running";
  audioWorklet = { addModule: (...args: unknown[]) => FakeAudioContext.addModule(...args) };
  close = vi.fn().mockImplementation(async () => { this.state = "closed"; });
  source = { connect: vi.fn(), disconnect: vi.fn() };

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createMediaStreamSource = vi.fn(() => this.source);
}

class FakeAudioWorkletNode {
  static instances: FakeAudioWorkletNode[] = [];
  port: { onmessage: ((event: MessageEvent<ArrayBuffer>) => void) | null } = { onmessage: null };
  disconnect = vi.fn();

  constructor() {
    FakeAudioWorkletNode.instances.push(this);
  }
}

function audioTrack(deviceId: string, initialState: MediaStreamTrackState = "live") {
  let readyState = initialState;
  const listeners = new Set<() => void>();
  const track = {
    kind: "audio",
    label: `${deviceId} label`,
    get readyState() { return readyState; },
    stop: vi.fn(() => { readyState = "ended"; }),
    getSettings: () => ({ deviceId }),
    addEventListener: vi.fn((_event: string, listener: EventListenerOrEventListenerObject) => {
      listeners.add(listener as () => void);
    }),
    removeEventListener: vi.fn((_event: string, listener: EventListenerOrEventListenerObject) => {
      listeners.delete(listener as () => void);
    }),
    end: () => {
      readyState = "ended";
      listeners.forEach((listener) => listener());
    },
  };
  return track as unknown as MediaStreamTrack & { end: () => void; stop: ReturnType<typeof vi.fn> };
}

function mediaStream(track: MediaStreamTrack, id: string) {
  return {
    id,
    getTracks: () => [track],
    getAudioTracks: () => [track],
    getVideoTracks: () => [],
  } as unknown as MediaStream;
}

beforeEach(() => {
  FakeAudioContext.instances = [];
  FakeAudioContext.addModule.mockReset().mockResolvedValue(undefined);
  FakeAudioWorkletNode.instances = [];
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("AudioWorkletNode", FakeAudioWorkletNode);
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: vi.fn() },
    configurable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useAudioCapture microphone ownership", () => {
  it("uses the verified stream once and keeps the speaker gate closed until unmuted", async () => {
    const track = audioTrack("verified-device");
    const stream = mediaStream(track, "verified-stream");
    const onFrame = vi.fn();
    const { result, unmount } = renderHook(() => useAudioCapture({ onFrame }));
    let startResult: AudioCaptureStartResult | undefined;

    await act(async () => {
      startResult = await result.current.start({ stream, deviceId: "verified-device" });
    });

    expect(startResult).toMatchObject({ source: "verified", deviceChanged: false });
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(FakeAudioContext.instances[0].createMediaStreamSource).toHaveBeenCalledWith(stream);

    const frame = new ArrayBuffer(4);
    act(() => FakeAudioWorkletNode.instances[0].port.onmessage?.({ data: frame } as MessageEvent<ArrayBuffer>));
    expect(onFrame).not.toHaveBeenCalled();
    act(() => result.current.unmute());
    act(() => FakeAudioWorkletNode.instances[0].port.onmessage?.({ data: frame } as MessageEvent<ArrayBuffer>));
    expect(onFrame).toHaveBeenCalledWith(frame);

    act(() => result.current.stop());
    act(() => result.current.stop());
    unmount();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(FakeAudioContext.instances[0].close).toHaveBeenCalledTimes(1);
    expect(FakeAudioWorkletNode.instances[0].disconnect).toHaveBeenCalledTimes(1);
  });

  it("reacquires the preferred device when the verified track already ended", async () => {
    const endedTrack = audioTrack("verified-device", "ended");
    const fallbackTrack = audioTrack("verified-device");
    const fallbackStream = mediaStream(fallbackTrack, "fallback-stream");
    const getUserMedia = vi.fn().mockResolvedValue(fallbackStream);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });
    const verified: VerifiedMicrophone = {
      stream: mediaStream(endedTrack, "ended-stream"),
      deviceId: "verified-device",
    };
    const { result } = renderHook(() => useAudioCapture({ onFrame: vi.fn() }));
    let startResult: AudioCaptureStartResult | undefined;

    await act(async () => {
      startResult = await result.current.start(verified);
    });

    expect(startResult).toMatchObject({ source: "fallback", deviceChanged: false });
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({ deviceId: { exact: "verified-device" } }),
    });
    expect(endedTrack.stop).toHaveBeenCalledTimes(1);
    expect(FakeAudioContext.instances[0].createMediaStreamSource).toHaveBeenCalledWith(fallbackStream);
  });

  it("falls back to the browser default and reports a device change when the verified device is gone", async () => {
    const endedTrack = audioTrack("missing-device", "ended");
    const fallbackTrack = audioTrack("replacement-device");
    const fallbackStream = mediaStream(fallbackTrack, "replacement-stream");
    const unavailable = new DOMException("device missing", "NotFoundError");
    const getUserMedia = vi.fn()
      .mockRejectedValueOnce(unavailable)
      .mockResolvedValueOnce(fallbackStream);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });
    const { result } = renderHook(() => useAudioCapture({ onFrame: vi.fn() }));

    let startResult: AudioCaptureStartResult | undefined;
    await act(async () => {
      startResult = await result.current.start({
        stream: mediaStream(endedTrack, "ended-stream"),
        deviceId: "missing-device",
      });
    });

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(startResult).toMatchObject({
      source: "fallback",
      deviceChanged: true,
      deviceId: "replacement-device",
    });
  });

  it("rechecks the verified track after async worklet setup and falls back if it ended", async () => {
    let resolveModule!: () => void;
    FakeAudioContext.addModule.mockReturnValue(new Promise<void>((resolve) => { resolveModule = resolve; }));
    const verifiedTrack = audioTrack("verified-device");
    const replacementTrack = audioTrack("verified-device");
    const replacementStream = mediaStream(replacementTrack, "replacement-stream");
    const getUserMedia = vi.fn().mockResolvedValue(replacementStream);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });
    const { result } = renderHook(() => useAudioCapture({ onFrame: vi.fn() }));

    let startPromise!: Promise<AudioCaptureStartResult>;
    act(() => {
      startPromise = result.current.start({
        stream: mediaStream(verifiedTrack, "verified-stream"),
        deviceId: "verified-device",
      });
    });
    verifiedTrack.end();
    resolveModule();

    let startResult: AudioCaptureStartResult | undefined;
    await act(async () => {
      startResult = await startPromise;
    });

    expect(startResult).toMatchObject({ source: "fallback", deviceChanged: false });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(verifiedTrack.stop).toHaveBeenCalledTimes(1);
    expect(FakeAudioContext.instances[0].createMediaStreamSource).toHaveBeenCalledWith(replacementStream);
  });

  it("stops a fallback stream that resolves after unmount", async () => {
    let resolveModule!: () => void;
    let resolveFallback!: (stream: MediaStream) => void;
    FakeAudioContext.addModule.mockReturnValue(new Promise<void>((resolve) => { resolveModule = resolve; }));
    const verifiedTrack = audioTrack("verified-device");
    const replacementTrack = audioTrack("verified-device");
    const replacementStream = mediaStream(replacementTrack, "replacement-stream");
    const getUserMedia = vi.fn().mockReturnValue(
      new Promise<MediaStream>((resolve) => { resolveFallback = resolve; })
    );
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });
    const onError = vi.fn();
    const { result, unmount } = renderHook(() => useAudioCapture({ onFrame: vi.fn(), onError }));

    let startPromise!: Promise<AudioCaptureStartResult>;
    act(() => {
      startPromise = result.current.start({
        stream: mediaStream(verifiedTrack, "verified-stream"),
        deviceId: "verified-device",
      });
    });
    verifiedTrack.end();
    resolveModule();
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));

    unmount();
    resolveFallback(replacementStream);
    await expect(startPromise).resolves.toMatchObject({ source: "cancelled" });

    expect(replacementTrack.stop).toHaveBeenCalledTimes(1);
    expect(FakeAudioWorkletNode.instances).toHaveLength(0);
    expect(onError).not.toHaveBeenCalled();
  });

  it("cleans an active stream when the hook unmounts", async () => {
    const track = audioTrack("verified-device");
    const stream = mediaStream(track, "verified-stream");
    const { result, unmount } = renderHook(() => useAudioCapture({ onFrame: vi.fn() }));

    await act(async () => {
      await result.current.start({ stream, deviceId: "verified-device" });
    });
    unmount();

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(FakeAudioContext.instances[0].close).toHaveBeenCalledTimes(1);
  });
});
