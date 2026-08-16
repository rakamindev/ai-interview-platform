import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DEFAULT_THRESHOLDS, testInternetSpeed } from "./internetSpeedTest";
import { BASE_URL } from "@/services/api";

// Upload must use the backend's own endpoint (no third-party echo hosts).
const EXPECTED_UPLOAD_URL = `${BASE_URL}/speed_test`;

const okResponse = () =>
  new Response(new Blob(["x"]), { status: 200, statusText: "OK" });

const errorResponse = () =>
  new Response(null, { status: 503, statusText: "Service Unavailable" });

describe("testInternetSpeed", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("uploads to the backend's own /speed_test endpoint (no external host)", async () => {
    fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init && init.method === "POST") return okResponse();
        return okResponse();
      },
    );

    const result = await testInternetSpeed();

    const postCall = fetchMock.mock.calls.find(
      ([input, init]) => init && (init as RequestInit).method === "POST",
    );
    expect(postCall).toBeDefined();
    expect(String(postCall![0])).toBe(EXPECTED_UPLOAD_URL);
    expect(result.upload).toBeGreaterThan(0);
  });

  it("counts a non-2xx upload endpoint as a FAILED test, not a fake-fast upload", async () => {
    // Old behaviour: 503/404 still resolved fetch and was measured as an
    // instant (fake) fast upload. Now every non-2xx run contributes 0, so a
    // flaky/offline endpoint can never produce a passing upload number.
    fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init && init.method === "POST") return errorResponse();
        return okResponse();
      },
    );

    const result = await testInternetSpeed();

    expect(result.upload).toBe(0);
    expect(result.uploadTests.every((v) => v === 0)).toBe(true);
    expect(result.passed).toBe(false);
  });

  it("returns an honest failure (0/0/999, not passed) when the network is down", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));

    const result = await testInternetSpeed(DEFAULT_THRESHOLDS);

    expect(result.download).toBe(0);
    expect(result.upload).toBe(0);
    expect(result.ping).toBe(999);
    expect(result.passed).toBe(false);
  });

  it("passes only when all thresholds are met", async () => {
    fetchMock.mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init && init.method === "POST") return okResponse();
        return okResponse();
      },
    );

    const result = await testInternetSpeed({
      minDownloadMbps: 0,
      minUploadMbps: 0,
      maxPingMs: 100000,
    });

    expect(result.passed).toBe(true);
  });
});
