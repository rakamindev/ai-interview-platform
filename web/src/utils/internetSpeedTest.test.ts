import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { testInternetSpeed, DEFAULT_THRESHOLDS } from "./internetSpeedTest";

function okResponse() {
  return { ok: true, blob: () => Promise.resolve(new Blob()) };
}

describe("testInternetSpeed", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Regression: assessment/gap-analysis.md P0-5 — every measurement failing
  // (e.g. the speed-test backend is unreachable) used to fall back to a
  // hardcoded low number that looked like a real, bad measurement and hard-
  // blocked the candidate. It must come back "inconclusive" with no
  // fabricated numbers instead.
  it("returns inconclusive with null values when every measurement fails", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network error"));

    const result = await testInternetSpeed(DEFAULT_THRESHOLDS);

    expect(result.status).toBe("inconclusive");
    expect(result.download).toBeNull();
    expect(result.upload).toBeNull();
    expect(result.ping).toBeNull();
  });

  it("returns passed when every measurement succeeds well within threshold", async () => {
    vi.mocked(fetch).mockResolvedValue(okResponse() as unknown as Response);

    const result = await testInternetSpeed(DEFAULT_THRESHOLDS);

    expect(result.status).toBe("passed");
    expect(result.download).not.toBeNull();
    expect(result.upload).not.toBeNull();
    expect(result.ping).not.toBeNull();
  });

  // Partial data (some attempts succeeded, others didn't) isn't trustworthy
  // enough to fail a candidate on — only a complete measurement that's
  // genuinely below threshold counts as "failed".
  it("returns inconclusive rather than failed when only some metrics could be measured", async () => {
    vi.mocked(fetch).mockImplementation((url) => {
      const href = String(url);
      if (href.includes("health")) return Promise.resolve(okResponse() as unknown as Response);
      return Promise.reject(new Error("blocked"));
    });

    const result = await testInternetSpeed(DEFAULT_THRESHOLDS);

    expect(result.status).toBe("inconclusive");
    expect(result.download).toBeNull();
    expect(result.upload).toBeNull();
    expect(result.ping).not.toBeNull();
  });
});
