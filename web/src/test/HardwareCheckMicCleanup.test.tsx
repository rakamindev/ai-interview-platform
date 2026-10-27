import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HardwareCheck from "../components/HardwareCheck";
import { renderHook, act } from "@testing-library/react";
import { useAudioCapture } from "../hooks/useAudioCapture";

// Mock internet speed test
vi.mock("@/utils/internetSpeedTest", () => ({
  DEFAULT_THRESHOLDS: { minDownloadMbps: 1, minUploadMbps: 0.5, maxPingMs: 300 },
  testInternetSpeed: vi.fn().mockResolvedValue({
    passed: true,
    download: 25,
    upload: 10,
    ping: 20,
  }),
}));

class MockAudioContext {
  state = "running";
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
  createOscillator = vi.fn().mockReturnValue({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { setValueAtTime: vi.fn() },
  });
  createGain = vi.fn().mockReturnValue({
    connect: vi.fn(),
    gain: { setValueAtTime: vi.fn() },
  });
  createMediaStreamSource = vi.fn().mockReturnValue({
    connect: vi.fn(),
  });
  createAnalyser = vi.fn().mockReturnValue({
    fftSize: 256,
    frequencyBinCount: 128,
    connect: vi.fn(),
    getByteFrequencyData: vi.fn(),
  });
  destination = {};
  currentTime = 0;
  audioWorklet = {
    addModule: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Microphone Stream Lifecycle & Cleanup", () => {
  let mockTrack: { stop: ReturnType<typeof vi.fn>; enabled: boolean };
  let mockStream: any;

  beforeEach(() => {
    mockTrack = {
      stop: vi.fn(),
      enabled: true,
    };
    mockStream = {
      getTracks: vi.fn().mockReturnValue([mockTrack]),
    };

    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      configurable: true,
      writable: true,
    });

    (window as any).AudioContext = MockAudioContext;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("stops all audio tracks when HardwareCheck unmounts", async () => {
    const { unmount } = render(<HardwareCheck onStart={vi.fn()} />);

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Unmount HardwareCheck (e.g. user transitions to active interview)
    unmount();

    expect(mockTrack.stop).toHaveBeenCalled();
    expect(mockTrack.enabled).toBe(false);
  });

  it("stops microphone tracks when Start Interview is clicked in HardwareCheck", async () => {
    const onStartMock = vi.fn();
    render(<HardwareCheck onStart={onStartMock} />);

    const startBtn = await screen.findByRole("button", { name: /Start Interview/i });

    await waitFor(() => {
      expect(startBtn).not.toBeDisabled();
    }, { timeout: 4000 });

    fireEvent.click(startBtn);

    expect(mockTrack.stop).toHaveBeenCalled();
    expect(mockTrack.enabled).toBe(false);
    expect(onStartMock).toHaveBeenCalledTimes(1);
  });

  it("stops microphone tracks in useAudioCapture on stop() and unmount", async () => {
    const onFrameMock = vi.fn();
    const { result, unmount } = renderHook(() =>
      useAudioCapture({ onFrame: onFrameMock })
    );

    // Call start
    await act(async () => {
      await result.current.start();
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();

    // Call stop
    act(() => {
      result.current.stop();
    });

    expect(mockTrack.stop).toHaveBeenCalled();
    expect(mockTrack.enabled).toBe(false);
    expect(result.current.isCapturing).toBe(false);

    // Unmount hook
    unmount();
  });
});
