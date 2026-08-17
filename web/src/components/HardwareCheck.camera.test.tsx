import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";

const speed = vi.hoisted(() => ({
  current: { download: 50, upload: 20, ping: 30, passed: true },
}));

vi.mock("@/utils/internetSpeedTest", () => ({
  DEFAULT_THRESHOLDS: { minDownloadMbps: 5, minUploadMbps: 2, maxPingMs: 150 },
  testInternetSpeed: vi.fn(() => Promise.resolve(speed.current)),
}));

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  vi.stubEnv("VITE_REQUIRE_CAMERA", "true");
  speed.current = { download: 50, upload: 20, ping: 30, passed: true };
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("HardwareCheck (camera required)", () => {
  it("runs the camera flow, shows the Camera row, and enables Start", async () => {
    const { default: HardwareCheck } = await import("./HardwareCheck");
    const onStart = vi.fn();
    renderWithProviders(<HardwareCheck onStart={onStart} />);

    // The Camera checklist row only exists in the camera-required build.
    expect(await screen.findByText("Camera")).toBeInTheDocument();

    const start = screen.getByRole("button", { name: "Start Interview" });
    await waitFor(() => expect(start).toBeEnabled(), { timeout: 6000 });
    fireEvent.click(start);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("marks the camera check failed when no stream is granted", async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("denied"),
    );
    const { default: HardwareCheck } = await import("./HardwareCheck");
    renderWithProviders(<HardwareCheck />);

    // Camera + microphone both fail, so assert the (unique) Retry affordance.
    expect(
      await screen.findByRole("button", { name: "Retry" }, { timeout: 6000 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Failed").length).toBeGreaterThan(0);
  });
});
