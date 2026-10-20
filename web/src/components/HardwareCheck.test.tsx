import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { testInternetSpeed, type InternetSpeedResult } from "@/utils/internetSpeedTest";
import HardwareCheck from "./HardwareCheck";

// The connection check is faked: what's under test is the order of the checks, not the measurement.
vi.mock("@/utils/internetSpeedTest", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/internetSpeedTest")>()),
  testInternetSpeed: vi.fn(),
}));

function speed(passed: boolean): InternetSpeedResult {
  return { download: 56, upload: passed ? 8 : 2, ping: 32, passed, downloadTests: [], uploadTests: [], pingTests: [] };
}

// A microphone and speakers that work: jsdom has neither.
class FakeAudioContext {
  state = "running";
  destination = {};
  currentTime = 0;
  resume = async () => {};
  createOscillator = () => ({ connect() {}, start() {}, stop() {}, frequency: { setValueAtTime() {} } });
  createGain = () => ({ connect() {}, gain: { setValueAtTime() {} } });
  createMediaStreamSource = () => ({ connect() {} });
  createAnalyser = () => ({ fftSize: 0, frequencyBinCount: 4, getByteFrequencyData() {} });
}

beforeEach(() => {
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("requestAnimationFrame", () => 0);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(testInternetSpeed).mockReset();
});

/** The status shown on the row with this label ("Passed", "Failed", "Waiting", "Checking..."). */
async function statusOf(label: string, expected: string) {
  const row = screen.getByText(label).closest("div.px-4") as HTMLElement;
  return within(row).findByText(expected, {}, { timeout: 8000 });
}

// Each test waits through the real 800 ms OS step and the chain after it; the suite runs files in parallel.
describe("HardwareCheck", { timeout: 20000 }, () => {
  it("lets the candidate start once every check passes", async () => {
    vi.mocked(testInternetSpeed).mockResolvedValue(speed(true));
    render(<HardwareCheck />);

    await statusOf("Audio output", "Passed");
    // Start is enabled one render later: the component works out "all passed" in an effect.
    await waitFor(() => expect(screen.getByRole("button", { name: "Start Interview" })).toBeEnabled());
  });

  it("keeps Start disabled until the camera and screen share are ready, when the assessment requires them", async () => {
    vi.mocked(testInternetSpeed).mockResolvedValue(speed(true));
    render(<HardwareCheck extraReady={false} />);

    await statusOf("Audio output", "Passed");
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole("button", { name: "Start Interview" })).toBeDisabled();
  });

  it("checks the microphone and audio output even when the connection check fails (P2-21)", async () => {
    vi.mocked(testInternetSpeed).mockResolvedValue(speed(false));
    render(<HardwareCheck />);

    await statusOf("Internet", "Failed");
    await statusOf("Microphone", "Passed");
    await statusOf("Audio output", "Passed");
    expect(screen.getByRole("button", { name: "Start Interview" })).toBeDisabled();
  });

  it("checks the audio output even when the microphone is blocked (P2-21)", async () => {
    vi.mocked(testInternetSpeed).mockResolvedValue(speed(true));
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    render(<HardwareCheck />);

    await statusOf("Microphone", "Failed");
    await statusOf("Audio output", "Passed");
    expect(screen.getByRole("button", { name: "Start Interview" })).toBeDisabled();
  });
});

describe("HardwareCheck, known defects", { timeout: 30000 }, () => {
  // Retry reset the rows, but the first step only ran once, on mount: the page stuck on "Checking..." and the
  // candidate's only way out was a reload.
  it("P2-23: Retry runs the checks again", async () => {
    vi.mocked(testInternetSpeed).mockResolvedValueOnce(speed(false)).mockResolvedValue(speed(true));
    const user = userEvent.setup();
    render(<HardwareCheck />);
    await statusOf("Internet", "Failed");

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await statusOf("Internet", "Passed");
    expect(testInternetSpeed).toHaveBeenCalledTimes(2);
  });

  // The check's microphone stream and its level meter outlived it: Chrome showed the mic as in use after the
  // interview ended, and the meter loop ran all interview long.
  it("P2-24: stops the microphone and the level meter it started when it goes away", async () => {
    vi.mocked(testInternetSpeed).mockResolvedValue(speed(true));
    const micTrack = { stop: vi.fn() };
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue({ getTracks: () => [micTrack] } as unknown as MediaStream);
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 7));
    const cancel = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const { unmount } = render(<HardwareCheck />);
    await statusOf("Microphone", "Passed");

    unmount();

    expect(micTrack.stop).toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledWith(7);
  });
});
