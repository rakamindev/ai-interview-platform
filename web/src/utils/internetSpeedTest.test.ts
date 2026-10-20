import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_THRESHOLDS, testInternetSpeed } from "./internetSpeedTest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

// The production CSP in vercel.json only allows requests to our own origin and the API.
// The browser rejects anything else the same way it rejects a dead connection.
function fetchUnderProductionCsp() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (!url.startsWith("/")) throw new TypeError("Failed to fetch (blocked by Content-Security-Policy)");
    return new Response(new Blob([new Uint8Array(256 * 1024)]));
  });
}

describe("testInternetSpeed", () => {
  it("fails the check when the candidate has no connection at all", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const result = await testInternetSpeed();

    expect(result.passed).toBe(false);
    expect(result.download).toBe(0);
    expect(result.ping).toBe(999);
  });

  // When every upload attempt fails, it reports a made-up 0.5 MB/s (4 Mbps),
  // above the 1 Mbps minimum, so the upload line shows green for a dead connection.
  it.fails("does not report an upload speed when no upload succeeded (known defect)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const result = await testInternetSpeed();

    expect(result.upload).toBe(0);
  });

  // P1-12: the download test has no override and always goes to third-party CDNs, which the
  // production CSP blocks. Download reads 0, the check fails, and Start stays disabled for
  // every candidate, even with VITE_SPEED_TEST_* pointed at our own server.
  it.fails("P1-12: passes a good connection when only our own origin is reachable (production CSP)", async () => {
    vi.stubEnv("VITE_SPEED_TEST_PING_URL", "/api/v1/health");
    vi.stubEnv("VITE_SPEED_TEST_UPLOAD_URL", "/api/v1/speed_test");
    const fetch = fetchUnderProductionCsp();
    vi.stubGlobal("fetch", fetch);
    const { testInternetSpeed: underCsp } = await import("./internetSpeedTest");

    const result = await underCsp();

    // The overrides are in effect: ping and upload went to our own server.
    expect(fetch).toHaveBeenCalledWith("/api/v1/health", expect.anything());
    expect(fetch).toHaveBeenCalledWith("/api/v1/speed_test", expect.anything());
    expect(result.download).toBeGreaterThan(0);
    expect(result.passed).toBe(true);
  });
});

describe("DEFAULT_THRESHOLDS", () => {
  // The interview streams the microphone as 16 kHz mono 16-bit PCM: 256 kbps. Asking for 4 Mbps turned away
  // candidates whose upload carries it many times over (one measured 2.07 Mbps).
  it("asks for no more upload than the interview needs, with room to spare", () => {
    const interviewUploadMbps = (16000 * 16) / 1_000_000;

    expect(DEFAULT_THRESHOLDS.minUploadMbps).toBeLessThanOrEqual(1);
    expect(DEFAULT_THRESHOLDS.minUploadMbps).toBeGreaterThanOrEqual(interviewUploadMbps * 3);
  });
});
