import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";
import HardwareCheck from "./HardwareCheck";

const speed = vi.hoisted(() => ({
  current: { download: 50, upload: 20, ping: 30, passed: true } as {
    download: number;
    upload: number;
    ping: number;
    passed: boolean;
  },
}));

vi.mock("@/utils/internetSpeedTest", () => ({
  DEFAULT_THRESHOLDS: { minDownloadMbps: 5, minUploadMbps: 2, maxPingMs: 150 },
  testInternetSpeed: vi.fn(() => Promise.resolve(speed.current)),
}));

beforeEach(() => {
  // Prevent the recursive rAF loop in startAudioLevelMonitoring from spinning.
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  speed.current = { download: 50, upload: 20, ping: 30, passed: true };
});

describe("HardwareCheck", () => {
  it("runs every check and enables Start when all pass", async () => {
    const onStart = vi.fn();
    renderWithProviders(<HardwareCheck onStart={onStart} />);

    const start = screen.getByRole("button", { name: "Start Interview" });
    expect(start).toBeDisabled();

    await waitFor(() => expect(start).toBeEnabled(), { timeout: 6000 });
    // Internet detail rendered with the "meets threshold" (green) styling.
    expect(screen.getByText("↓ 50 Mbps")).toBeInTheDocument();
    expect(screen.getByText("↑ 20 Mbps")).toBeInTheDocument();
    expect(screen.getByText("30 ms")).toBeInTheDocument();

    fireEvent.click(start);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("fails the internet step and resets when Retry is clicked", async () => {
    speed.current = { download: 1, upload: 0.5, ping: 400, passed: false };
    renderWithProviders(<HardwareCheck />);

    const retry = await screen.findByRole("button", { name: "Retry" }, { timeout: 6000 });
    expect(screen.getByText("↓ 1 Mbps")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Interview" })).toBeDisabled();

    fireEvent.click(retry);
    // retryAll clears the internet result, so the speed detail disappears.
    await waitFor(() => expect(screen.queryByText("↓ 1 Mbps")).not.toBeInTheDocument());
  });

  it("marks the microphone as failed when no stream is granted", async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("denied"),
    );
    renderWithProviders(<HardwareCheck />);

    await waitFor(() => expect(screen.getByText("Failed")).toBeInTheDocument(), { timeout: 6000 });
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
