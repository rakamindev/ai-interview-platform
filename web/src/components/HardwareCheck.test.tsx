import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HardwareCheck from "./HardwareCheck";
import { testInternetSpeed } from "@/utils/internetSpeedTest";

vi.mock("@/utils/internetSpeedTest", () => ({
  DEFAULT_THRESHOLDS: { minDownloadMbps: 8, minUploadMbps: 4, maxPingMs: 300 },
  testInternetSpeed: vi.fn(),
}));

const slow = { download: 2, upload: 1, ping: 80, passed: false, downloadTests: [], uploadTests: [], pingTests: [] };
const fast = { download: 20, upload: 10, ping: 30, passed: true, downloadTests: [], uploadTests: [], pingTests: [] };

const osRow = () => screen.getByText("OS & browser").closest("div")!.parentElement!;

// F12: "Retry" reset the OS & browser step to loading but that step only ran on mount,
// so the candidate was stuck on "Checking..." forever.
describe("HardwareCheck retry", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) },
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("re-runs every step after a failed internet check", async () => {
    vi.mocked(testInternetSpeed).mockResolvedValueOnce(slow).mockResolvedValueOnce(fast);
    render(<HardwareCheck />);

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(await screen.findByText("Failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(osRow()).toHaveTextContent("Passed");
    expect(testInternetSpeed).toHaveBeenCalledTimes(2);
  });
});
