import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HardwareCheck from "./HardwareCheck";

const mocks = vi.hoisted(() => ({
  testInternetSpeed: vi.fn(),
  getBrowserInfo: vi.fn(),
  getOSInfo: vi.fn(),
  getCurrentTime: vi.fn(),
}));

vi.mock("@/utils/internetSpeedTest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/internetSpeedTest")>();
  return { ...actual, testInternetSpeed: mocks.testInternetSpeed };
});

vi.mock("@/utils/hardwareUtils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/hardwareUtils")>();
  return {
    ...actual,
    getBrowserInfo: mocks.getBrowserInfo,
    getOSInfo: mocks.getOSInfo,
    getCurrentTime: mocks.getCurrentTime,
  };
});

const failedInternet = {
  download: 1,
  upload: 1,
  ping: 500,
  passed: false,
  downloadTests: [1],
  uploadTests: [1],
  pingTests: [500],
};

const passingInternet = {
  download: 20,
  upload: 10,
  ping: 20,
  passed: true,
  downloadTests: [20],
  uploadTests: [10],
  pingTests: [20],
};

describe("HardwareCheck", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.testInternetSpeed
      .mockResolvedValueOnce(failedInternet)
      .mockResolvedValueOnce(passingInternet);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(null) },
    });
  });

  it("runs the OS and browser step again after retry", async () => {
    render(<HardwareCheck />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(mocks.getBrowserInfo).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(mocks.getBrowserInfo).toHaveBeenCalledTimes(2);
    expect(mocks.getOSInfo).toHaveBeenCalledTimes(2);
    expect(mocks.testInternetSpeed).toHaveBeenCalledTimes(2);
  });
});
