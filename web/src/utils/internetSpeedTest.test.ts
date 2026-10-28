import { describe, it, expect } from "vitest";
import { DEFAULT_THRESHOLDS } from "./internetSpeedTest";

describe("InternetSpeedTest Configuration & Logic", () => {
  it("should have realistic default thresholds for candidate network conditions", () => {
    expect(DEFAULT_THRESHOLDS.minDownloadMbps).toBe(8);
    // Verified fix: 0.2 Mbps accommodates common asymmetric home internet in Indonesia
    expect(DEFAULT_THRESHOLDS.minUploadMbps).toBe(0.2);
    expect(DEFAULT_THRESHOLDS.maxPingMs).toBe(300);
  });

  it("should pass when download, upload, and ping meet thresholds", () => {
    const downloadMbps = 10;
    const uploadMbps = 0.5;
    const ping = 50;

    const passed =
      downloadMbps >= DEFAULT_THRESHOLDS.minDownloadMbps &&
      uploadMbps >= DEFAULT_THRESHOLDS.minUploadMbps &&
      ping <= DEFAULT_THRESHOLDS.maxPingMs;

    expect(passed).toBe(true);
  });

  it("should fail when upload speed is lower than minUploadMbps", () => {
    const downloadMbps = 10;
    const uploadMbps = 0.1; // below 0.2 Mbps
    const ping = 50;

    const passed =
      downloadMbps >= DEFAULT_THRESHOLDS.minDownloadMbps &&
      uploadMbps >= DEFAULT_THRESHOLDS.minUploadMbps &&
      ping <= DEFAULT_THRESHOLDS.maxPingMs;

    expect(passed).toBe(false);
  });

  it("should fail when ping exceeds maxPingMs", () => {
    const downloadMbps = 10;
    const uploadMbps = 1.0;
    const ping = 450; // exceeds 300ms

    const passed =
      downloadMbps >= DEFAULT_THRESHOLDS.minDownloadMbps &&
      uploadMbps >= DEFAULT_THRESHOLDS.minUploadMbps &&
      ping <= DEFAULT_THRESHOLDS.maxPingMs;

    expect(passed).toBe(false);
  });
});
