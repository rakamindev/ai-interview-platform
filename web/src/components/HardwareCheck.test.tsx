import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HardwareCheck from "./HardwareCheck";

const speedTest = vi.hoisted(() => vi.fn());

vi.mock("@/utils/internetSpeedTest", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/internetSpeedTest")>()),
  testInternetSpeed: speedTest,
}));

class AudioContextMock {
  state = "running";
  currentTime = 0;
  destination = {};

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
    throw new Error("Audio level monitoring is not needed in this test");
  }
}

describe("HardwareCheck", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "AudioContext", { configurable: true, value: AudioContextMock });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
      },
    });
    speedTest.mockResolvedValue({
      download: 2,
      upload: 1,
      ping: 450,
      passed: false,
      downloadTests: [],
      uploadTests: [],
      pingTests: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("warns about a below-threshold connection but lets the candidate start after device checks pass", async () => {
    const onStart = vi.fn();
    render(<HardwareCheck onStart={onStart} />);

    await act(async () => {
      vi.advanceTimersByTime(800);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("You can still continue");
    expect(screen.getByRole("status")).toHaveTextContent("switch to a stronger or more stable internet connection");

    const startButton = screen.getByRole("button", { name: "Start Interview Anyway" });
    expect(startButton).toBeEnabled();
    fireEvent.click(startButton);
    expect(onStart).toHaveBeenCalledOnce();
  });
});
