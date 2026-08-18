import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const okResponse = { ok: true, blob: async () => new Blob(["x"]) };

describe("internetSpeedTest — upload target (F8 regression)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("measures upload against our own backend's /speed_test endpoint, not a third-party echo service", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://localhost:3001/api/v1");
    vi.stubEnv("VITE_SPEED_TEST_UPLOAD_URL", "");

    const { testInternetSpeed, DEFAULT_THRESHOLDS } = await import("@/utils/internetSpeedTest");
    await testInternetSpeed(DEFAULT_THRESHOLDS);

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const uploadCalls = fetchMock.mock.calls.filter(([, opts]) => opts?.method === "POST");

    expect(uploadCalls.length).toBeGreaterThan(0);
    for (const [url] of uploadCalls) {
      expect(String(url)).toContain("localhost:3001/api/v1/speed_test");
      expect(String(url)).not.toMatch(/httpbin|postman-echo/);
    }
  });

  it("respects an explicit VITE_SPEED_TEST_UPLOAD_URL override over the backend default", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://localhost:3001/api/v1");
    vi.stubEnv("VITE_SPEED_TEST_UPLOAD_URL", "http://localhost:9999/custom-echo");

    const { testInternetSpeed, DEFAULT_THRESHOLDS } = await import("@/utils/internetSpeedTest");
    await testInternetSpeed(DEFAULT_THRESHOLDS);

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const uploadCalls = fetchMock.mock.calls.filter(([, opts]) => opts?.method === "POST");

    expect(uploadCalls.length).toBeGreaterThan(0);
    for (const [url] of uploadCalls) {
      expect(String(url)).toBe("http://localhost:9999/custom-echo");
    }
  });
});
