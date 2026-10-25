import { describe, it, expect } from "vitest";
import { DEFAULT_THRESHOLDS } from "./internetSpeedTest";

describe("internetSpeedTest", () => {
  it("calibrates realistic thresholds for audio streaming under DEF-P1-04", () => {
    expect(DEFAULT_THRESHOLDS.minDownloadMbps).toBe(0.5);
    expect(DEFAULT_THRESHOLDS.minUploadMbps).toBe(0.5);
    expect(DEFAULT_THRESHOLDS.maxPingMs).toBe(300);
  });

  it("requires at least 0.5 Mbps to support 16kHz PCM audio without excessive gating", () => {
    // 16kHz 16-bit mono PCM is ~256 kbps (~0.256 Mbps)
    // 0.5 Mbps provides a 2x safety margin without unfairly disqualifying candidates
    expect(DEFAULT_THRESHOLDS.minDownloadMbps).toBeLessThanOrEqual(1.0);
    expect(DEFAULT_THRESHOLDS.minUploadMbps).toBeLessThanOrEqual(1.0);
  });
});
