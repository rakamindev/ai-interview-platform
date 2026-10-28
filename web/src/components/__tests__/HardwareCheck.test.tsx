import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import HardwareCheck from "../HardwareCheck";
import * as internetSpeedTest from "@/utils/internetSpeedTest";

// Mock internet speed test
vi.mock("@/utils/internetSpeedTest", () => ({
  DEFAULT_THRESHOLDS: {
    minDownloadMbps: 8,
    minUploadMbps: 4,
    maxPingMs: 300,
  },
  testInternetSpeed: vi.fn(),
}));

describe("HardwareCheck Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock getUserMedia
    const mockTrack = { stop: vi.fn() };
    const mockStream = {
      getTracks: () => [mockTrack],
      getAudioTracks: () => [mockTrack],
    } as unknown as MediaStream;

    Object.defineProperty(navigator, "mediaDevices", {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });

    // Mock AudioContext
    const mockOscillator = {
      type: "sine",
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
    const mockAnalyser = {
      fftSize: 256,
      frequencyBinCount: 128,
      getByteFrequencyData: vi.fn(),
    };

    class MockAudioContext {
      state = "running";
      currentTime = 0;
      destination = {};
      resume = vi.fn().mockResolvedValue(undefined);
      createOscillator = vi.fn().mockReturnValue(mockOscillator);
      createGain = vi.fn().mockReturnValue(mockGain);
      createMediaStreamSource = vi.fn().mockReturnValue({ connect: vi.fn() });
      createAnalyser = vi.fn().mockReturnValue(mockAnalyser);
    }

    Object.defineProperty(window, "AudioContext", {
      writable: true,
      value: MockAudioContext,
    });
  });

  it("advances through hardware check steps and renders Lucide icons", async () => {
    vi.mocked(internetSpeedTest.testInternetSpeed).mockResolvedValue({
      download: 35,
      upload: 15,
      ping: 25,
      passed: true,
      downloadTests: [35],
      uploadTests: [15],
      pingTests: [25],
    });

    render(<HardwareCheck onStart={vi.fn()} />);

    // Verify card is rendered
    expect(screen.getByTestId("hardware-check-card")).toBeInTheDocument();

    // Verify checklist labels are in place
    expect(screen.getByText("Sistem Operasi & Browser")).toBeInTheDocument();
    expect(screen.getByText("Koneksi Internet")).toBeInTheDocument();
    expect(screen.getByText("Mikrofon Input")).toBeInTheDocument();
    expect(screen.getByText("Speaker / Audio Output")).toBeInTheDocument();

    // Wait for all steps to finish and pass
    await waitFor(
      () => {
        expect(screen.getByTestId("hardware-start-btn")).not.toBeDisabled();
      },
      { timeout: 3000 }
    );

    // Audio decibel meter should be rendered for microphone
    expect(screen.getByTestId("audio-decibel-meter")).toBeInTheDocument();

    // Chime play button should be available
    expect(screen.getByTestId("play-test-chime-btn")).toBeInTheDocument();
  });

  it("plays test chime when button is clicked", async () => {
    vi.mocked(internetSpeedTest.testInternetSpeed).mockResolvedValue({
      download: 35,
      upload: 15,
      ping: 25,
      passed: true,
      downloadTests: [35],
      uploadTests: [15],
      pingTests: [25],
    });

    render(<HardwareCheck onStart={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("play-test-chime-btn")).toBeInTheDocument();
    });

    const chimeBtn = screen.getByTestId("play-test-chime-btn");
    fireEvent.click(chimeBtn);

    // Button should reflect interaction
    await waitFor(() => {
      expect(screen.getByText("Suara terkonfirmasi")).toBeInTheDocument();
    });
  });
});
