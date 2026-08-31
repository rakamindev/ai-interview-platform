import { vi } from "vitest";

export function mockGetUserMedia() {
  const getUserMedia = vi.fn().mockResolvedValue({
    getTracks: () => [{ stop: vi.fn() }],
  } as unknown as MediaStream);

  Object.defineProperty(navigator, "mediaDevices", {
    writable: true,
    configurable: true,
    value: { getUserMedia },
  });

  return getUserMedia;
}

export function mockAudioContext() {
  return class MockAudioContext {
    state = "running";
    currentTime = 0;
    destination = {};
    resume = vi.fn().mockResolvedValue(undefined);
    close = vi.fn();

    createOscillator() {
      return {
        connect: vi.fn(),
        frequency: { setValueAtTime: vi.fn() },
        start: vi.fn(),
        stop: vi.fn(),
      };
    }

    createGain() {
      return {
        connect: vi.fn(),
        gain: { setValueAtTime: vi.fn() },
      };
    }

    createMediaStreamSource() {
      return { connect: vi.fn() };
    }

    createAnalyser() {
      return {
        fftSize: 256,
        frequencyBinCount: 128,
        getByteFrequencyData: vi.fn(),
      };
    }
  };
}
