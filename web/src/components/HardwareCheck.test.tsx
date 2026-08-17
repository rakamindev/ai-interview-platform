import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import HardwareCheck from "@/components/HardwareCheck";
import { testInternetSpeed } from "@/utils/internetSpeedTest";

vi.mock("@/utils/internetSpeedTest", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/utils/internetSpeedTest")>();
  return { ...actual, testInternetSpeed: vi.fn() };
});

const testInternetSpeedMock = vi.mocked(testInternetSpeed);

// AudioContext fake. `failPlayback` makes checkAudioPlayback reject while the
// mic level-monitor (createMediaStreamSource/analyser) keeps working.
let failPlayback = false;
class FakeAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  resume = vi.fn().mockResolvedValue(undefined);
  createOscillator() {
    if (failPlayback) throw new Error("no audio output");
    return {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: { setValueAtTime: vi.fn() },
    };
  }
  createGain() {
    return { connect: vi.fn(), gain: { setValueAtTime: vi.fn() } };
  }
  createMediaStreamSource() {
    return { connect: vi.fn() };
  }
  createAnalyser() {
    return {
      fftSize: 0,
      frequencyBinCount: 1,
      getByteFrequencyData: vi.fn(() => {}),
    };
  }
  close = vi.fn().mockResolvedValue(undefined);
}

function makeStream() {
  const track = { stop: vi.fn() };
  return {
    getTracks: vi.fn(() => [track]),
    stop: vi.fn(),
    track,
  };
}

const passedResult = {
  download: 80,
  upload: 40,
  ping: 50,
  passed: true,
  downloadTests: [80, 80],
  uploadTests: [40, 40],
  pingTests: [50, 50, 50],
};

describe("HardwareCheck (AC-F6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    failPlayback = false;
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("runs every check and enables Start Interview only when all pass", async () => {
    testInternetSpeedMock.mockResolvedValue(passedResult);
    const stream = makeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });

    render(<HardwareCheck onStart={() => {}} />);

    const start = await screen.findByRole("button", {
      name: /start interview/i,
    });
    await waitFor(() => expect(start).toBeEnabled());

    expect(screen.getAllByText("Passed")).toHaveLength(4);
    expect(
      screen.queryByRole("button", { name: /retry/i })
    ).not.toBeInTheDocument();
    expect(testInternetSpeedMock).toHaveBeenCalledTimes(1);
  });

  it("stops the captured mic stream when retrying after an audio failure", async () => {
    // Audio output check fails on the first run → Retry appears. The mic
    // stream acquired for that run must be released before re-running.
    failPlayback = true;
    testInternetSpeedMock.mockResolvedValue(passedResult);
    const stream1 = makeStream();
    const stream2 = makeStream();
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(stream1)
      .mockResolvedValueOnce(stream2);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });

    render(<HardwareCheck onStart={() => {}} />);

    const retry = await screen.findByRole("button", { name: /retry/i });
    expect(stream1.track.stop).not.toHaveBeenCalled();

    // Second run succeeds, so the whole cascade re-runs from step 1.
    failPlayback = false;
    fireEvent.click(retry);

    const start = await screen.findByRole("button", {
      name: /start interview/i,
    });
    await waitFor(() => expect(start).toBeEnabled());

    expect(stream1.track.stop).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(testInternetSpeedMock).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText("Passed")).toHaveLength(4);
    expect(
      screen.queryByRole("button", { name: /retry/i })
    ).not.toBeInTheDocument();
  });
});
