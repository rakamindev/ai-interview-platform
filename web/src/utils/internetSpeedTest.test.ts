import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// internetSpeedTest.ts reads VITE_SPEED_TEST_* from import.meta.env at module
// load time, so each test that needs a specific env value must stub it and
// re-import the module fresh (vi.resetModules) rather than importing once at
// the top of the file.
async function loadModule() {
  return import("./internetSpeedTest");
}

describe("testInternetSpeed", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("fails the check when every network request fails", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down"));

    const { testInternetSpeed, DEFAULT_THRESHOLDS } = await loadModule();
    const result = await testInternetSpeed(DEFAULT_THRESHOLDS);

    expect(result.passed).toBe(false);
    expect(result.download).toBe(0);
    expect(result.ping).toBe(999);
  });

  it("passes the check when download, upload and ping all clear the thresholds", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(new Blob(["x"])),
    });

    const { testInternetSpeed, DEFAULT_THRESHOLDS } = await loadModule();
    const result = await testInternetSpeed(DEFAULT_THRESHOLDS);

    expect(result.passed).toBe(true);
    expect(result.download).toBeGreaterThanOrEqual(DEFAULT_THRESHOLDS.minDownloadMbps);
    expect(result.ping).toBeLessThanOrEqual(DEFAULT_THRESHOLDS.maxPingMs);
  });

  // Regression coverage for the false-negative bug found in review: by
  // default, upload speed was measured against public third-party endpoints
  // (httpbin.org, postman-echo.com) which are frequently slow/rate-limited
  // independent of the candidate's real connection, blocking the "Start
  // Interview" button. The fix wires VITE_SPEED_TEST_UPLOAD_URL /
  // VITE_SPEED_TEST_PING_URL to the backend's own same-origin endpoints when
  // configured — this test proves that override is actually honored.
  it("uses the configured local endpoints instead of third-party services when set", async () => {
    vi.stubEnv("VITE_SPEED_TEST_PING_URL", "http://localhost:3001/health");
    vi.stubEnv("VITE_SPEED_TEST_UPLOAD_URL", "http://localhost:3001/api/v1/speed_test");

    const calledUrls: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      calledUrls.push(url);
      return Promise.resolve({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(new Blob(["x"])),
      });
    });

    const { testInternetSpeed, DEFAULT_THRESHOLDS } = await loadModule();
    await testInternetSpeed(DEFAULT_THRESHOLDS);

    expect(calledUrls).toContain("http://localhost:3001/health");
    expect(calledUrls).toContain("http://localhost:3001/api/v1/speed_test");
    expect(calledUrls.some((u) => u.includes("httpbin.org"))).toBe(false);
    expect(calledUrls.some((u) => u.includes("postman-echo.com"))).toBe(false);
  });

  it("falls back to public third-party endpoints when no local override is configured", async () => {
    vi.stubEnv("VITE_SPEED_TEST_PING_URL", "");
    vi.stubEnv("VITE_SPEED_TEST_UPLOAD_URL", "");

    const calledUrls: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      calledUrls.push(url);
      return Promise.reject(new Error("blocked in test"));
    });

    const { testInternetSpeed, DEFAULT_THRESHOLDS } = await loadModule();
    await testInternetSpeed(DEFAULT_THRESHOLDS);

    expect(calledUrls.some((u) => u.includes("httpbin.org") || u.includes("postman-echo.com"))).toBe(true);
  });
});
