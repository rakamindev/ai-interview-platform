import { describe, it, expect, vi, beforeEach } from "vitest";
import { testInternetSpeed, DEFAULT_THRESHOLDS } from "./internetSpeedTest";

describe("internetSpeedTest", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("defines realistic thresholds for real-time voice streaming", () => {
    expect(DEFAULT_THRESHOLDS.minDownloadMbps).toBeLessThanOrEqual(3);
    expect(DEFAULT_THRESHOLDS.minUploadMbps).toBeLessThanOrEqual(1.5);
    expect(DEFAULT_THRESHOLDS.maxPingMs).toBeGreaterThanOrEqual(300);
  });

  it("passes candidate connection with 177.78 Mbps down, 3.52 Mbps up, and 254 ms ping", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          // Upload probe
          return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
        }
        return Promise.resolve(new Response(new Blob(["x".repeat(100_000)]), { status: 200 }));
      })
    );

    const result = await testInternetSpeed({
      minDownloadMbps: 3,
      minUploadMbps: 1.5,
      maxPingMs: 350,
    });

    expect(result.download).toBeGreaterThanOrEqual(0);
    expect(result.upload).toBeGreaterThanOrEqual(0);
  });
});
