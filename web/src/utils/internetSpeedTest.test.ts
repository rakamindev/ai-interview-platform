import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { testInternetSpeed, DEFAULT_THRESHOLDS } from "./internetSpeedTest";

const resolvedResponse = () => ({ ok: true, blob: vi.fn().mockResolvedValue(new Blob()) });
const rejectedFetch = () => Promise.reject(new Error("network down"));

let clock = 0;

function mockClock() {
  clock = 0;
  vi.spyOn(performance, "now").mockImplementation(() => (clock += 50));
}

function mockFetchResolveAll() {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resolvedResponse()));
}

describe("internetSpeedTest", () => {
  beforeEach(() => {
    mockClock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("passes and reports positive speeds when all measurements succeed", async () => {
    mockFetchResolveAll();
    const result = await testInternetSpeed();
    expect(result.download).toBeGreaterThan(0);
    expect(result.upload).toBeGreaterThan(0);
    expect(result.ping).toBeGreaterThan(0);
    expect(result.passed).toBe(true);
    expect(result.downloadTests).toHaveLength(3);
    expect(result.uploadTests).toHaveLength(3);
    expect(result.pingTests).toHaveLength(3);
    expect(result.downloadTests.every((v) => v > 0)).toBe(true);
    expect(result.uploadTests.every((v) => v > 0)).toBe(true);
    expect(result.pingTests.every((v) => v > 0)).toBe(true);
  });

  it("passes even with very lenient thresholds", async () => {
    mockFetchResolveAll();
    const result = await testInternetSpeed({
      minDownloadMbps: 0.01,
      minUploadMbps: 0.01,
      maxPingMs: 99999,
    });
    expect(result.passed).toBe(true);
  });

  it("fails when download is below an impossible threshold", async () => {
    mockFetchResolveAll();
    const result = await testInternetSpeed({ ...DEFAULT_THRESHOLDS, minDownloadMbps: 1000 });
    expect(result.passed).toBe(false);
  });

  it("fails when upload is below an impossible threshold", async () => {
    mockFetchResolveAll();
    const result = await testInternetSpeed({ ...DEFAULT_THRESHOLDS, minUploadMbps: 1000 });
    expect(result.passed).toBe(false);
  });

  it("fails when ping exceeds a 1ms maximum", async () => {
    mockFetchResolveAll();
    const result = await testInternetSpeed({ ...DEFAULT_THRESHOLDS, maxPingMs: 1 });
    expect(result.passed).toBe(false);
  });

  it("falls back to a fixed download value when test-file fetches fail but the favicon succeeds", async () => {
    const fetchMock = vi.fn((url: string) =>
      url.includes("favicon.ico") ? Promise.resolve(resolvedResponse()) : rejectedFetch(),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await testInternetSpeed();
    expect(result.download).toBe(16);
    expect(result.downloadTests).toEqual([16, 16, 16]);
  });

  it("returns the conservative upload fallback when every upload endpoint fails", async () => {
    const fetchMock = vi.fn((url: string) =>
      url.includes("httpbin") || url.includes("postman")
        ? rejectedFetch()
        : Promise.resolve(resolvedResponse()),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await testInternetSpeed();
    expect(result.upload).toBe(4);
    expect(result.uploadTests).toEqual([4, 4, 4]);
  });

  it("reports failure with zeros/999 when the network is completely down", async () => {
    vi.stubGlobal("fetch", vi.fn(rejectedFetch));
    const result = await testInternetSpeed();
    expect(result).toEqual({
      download: 0,
      upload: 4,
      ping: 999,
      passed: false,
      downloadTests: [0, 0, 0],
      uploadTests: [4, 4, 4],
      pingTests: [999, 999, 999],
    });
  });

  it("uses the configured ping/upload URLs from the environment", async () => {
    vi.stubEnv("VITE_SPEED_TEST_PING_URL", "https://example.com/ping");
    vi.stubEnv("VITE_SPEED_TEST_UPLOAD_URL", "https://example.com/upload");
    const fetchMock = vi.fn().mockResolvedValue(resolvedResponse());
    vi.stubGlobal("fetch", fetchMock);

    const { testInternetSpeed: testWithEnv } = await import("./internetSpeedTest");
    await testWithEnv();

    expect(fetchMock.mock.calls.some(([url]) => url === "https://example.com/ping")).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => url === "https://example.com/upload")).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => url.includes("google.com"))).toBe(false);
  });

  it("returns 999 for ping when the configured ping endpoint fails", async () => {
    vi.stubEnv("VITE_SPEED_TEST_PING_URL", "https://example.com/ping");
    const fetchMock = vi.fn((url: string) =>
      url === "https://example.com/ping" ? rejectedFetch() : Promise.resolve(resolvedResponse()),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { testInternetSpeed: testWithEnv } = await import("./internetSpeedTest");
    const result = await testWithEnv();

    expect(result.ping).toBe(999);
    expect(result.pingTests).toEqual([999, 999, 999]);
    expect(result.passed).toBe(false);
  });
});
