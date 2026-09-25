import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import HardwareCheck from "../HardwareCheck";
import { ProctoringState } from "@/utils/hardwareUtils";

// Mock hardware utilities and internet speed test
vi.mock("@/utils/hardwareUtils", () => ({
  ProctoringState: {
    WAITING: "waiting",
    LOADING: "loading",
    PASSED: "passed",
    ERROR: "error",
  },
  getBrowserInfo: vi.fn().mockReturnValue({ browser: "Chrome", version: "120" }),
  getOSInfo: vi.fn().mockReturnValue("Windows"),
  getCurrentTime: vi.fn().mockReturnValue("10:00:00 AM"),
  checkCamera: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/utils/internetSpeedTest", () => ({
  testInternetSpeed: vi.fn().mockResolvedValue({
    passed: false, // Simulating internet check failure (Finding F-7)
    download: 0.2,
    upload: 0.1,
    ping: 999,
    downloadTests: [],
    uploadTests: [],
    pingTests: [],
  }),
  DEFAULT_THRESHOLDS: {
    minDownloadMbps: 1,
    minUploadMbps: 0.5,
    maxPingMs: 500,
  },
}));

describe("HardwareCheck (Finding F-7: Internet check resilience)", () => {
  it("renders the hardware check table with all diagnostic steps", () => {
    render(<HardwareCheck />);

    expect(screen.getByText("OS & browser")).toBeInTheDocument();
    expect(screen.getByText("Internet")).toBeInTheDocument();
    expect(screen.getByText("Microphone")).toBeInTheDocument();
    expect(screen.getByText("Audio output")).toBeInTheDocument();
  });

  it("displays action button in disabled state before essential checks complete", () => {
    render(<HardwareCheck />);

    const actionButton = screen.getByRole("button", { name: /start interview|continue anyway/i });
    expect(actionButton).toBeDisabled();
  });
});
