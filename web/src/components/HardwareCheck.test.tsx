import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HardwareCheck from "@/components/HardwareCheck";
import { testInternetSpeed, type InternetSpeedResult } from "@/utils/internetSpeedTest";

vi.mock("@/utils/internetSpeedTest", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/internetSpeedTest")>()),
  testInternetSpeed: vi.fn(),
}));

const speedResult = (passed: boolean): InternetSpeedResult => ({
  download: passed ? 20 : 1,
  upload: passed ? 10 : 1,
  ping: 50,
  passed,
  downloadTests: [],
  uploadTests: [],
  pingTests: [],
});

class FakeAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  resume = vi.fn();
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
    return { connect: vi.fn(), gain: { setValueAtTime: vi.fn() } };
  }
  createMediaStreamSource() {
    throw new Error("not available in jsdom");
  }
}

describe("HardwareCheck", () => {
  beforeEach(() => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("AudioWorkletNode", class {});
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(testInternetSpeed).mockReset();
  });

  it("re-runs every check after Retry instead of hanging on OS & browser", async () => {
    vi.mocked(testInternetSpeed)
      .mockResolvedValueOnce(speedResult(false))
      .mockResolvedValueOnce(speedResult(true));
    const user = userEvent.setup();

    render(<HardwareCheck />);

    const retry = await screen.findByRole("button", { name: /retry/i }, { timeout: 3000 });
    await user.click(retry);

    await waitFor(
      () => expect(screen.getByRole("button", { name: "Start Interview" })).toBeEnabled(),
      { timeout: 3000 },
    );
    expect(screen.queryByText("Checking...")).not.toBeInTheDocument();
    expect(screen.getAllByText("Passed")).toHaveLength(4);
    expect(testInternetSpeed).toHaveBeenCalledTimes(2);
  });

  describe("releasing the microphone", () => {
    beforeEach(() => {
      vi.mocked(testInternetSpeed).mockResolvedValue(speedResult(true));
    });

    function waitForMicRequest() {
      return waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled(), {
        timeout: 3000,
      });
    }

    it("stops the test stream when the check is left", async () => {
      const stopTrack = vi.fn();
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }),
        },
      });
      const { unmount } = render(<HardwareCheck />);
      await waitFor(
        () => expect(screen.getByRole("button", { name: "Start Interview" })).toBeEnabled(),
        { timeout: 3000 },
      );
      expect(stopTrack).not.toHaveBeenCalled();

      unmount();

      expect(stopTrack).toHaveBeenCalled();
    });

    it("stops a stream that is granted after the check was left", async () => {
      const stopTrack = vi.fn();
      let grantMic: (stream: unknown) => void = () => {};
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: { getUserMedia: vi.fn(() => new Promise((resolve) => (grantMic = resolve))) },
      });
      const { unmount } = render(<HardwareCheck />);
      await waitForMicRequest();

      unmount();
      await act(async () => grantMic({ getTracks: () => [{ stop: stopTrack }] }));

      expect(stopTrack).toHaveBeenCalled();
    });
  });

  it("fails the browser check with guidance when media APIs are unavailable", async () => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });

    render(<HardwareCheck />);

    expect(
      await screen.findByText(/missing features the interview needs/, {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(testInternetSpeed).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Start Interview" })).toBeDisabled();
  });

  it("explains how to fix a denied microphone", async () => {
    vi.mocked(testInternetSpeed).mockResolvedValue(speedResult(true));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error("NotAllowedError")) },
    });

    render(<HardwareCheck />);

    expect(
      await screen.findByText(/Allow microphone access/, {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Interview" })).toBeDisabled();
  });
});
