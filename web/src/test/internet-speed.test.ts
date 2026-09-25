import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_THRESHOLDS, testInternetSpeed } from "@/utils/internetSpeedTest";

afterEach(() => vi.restoreAllMocks());

describe("interview connection check", () => {
  it("checks the configured interview API instead of third-party services", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/speed_test?")) {
        return new Response(new Blob([new Uint8Array(262_144)]), { status: 200 });
      }
      if (init?.method === "POST") {
        return new Response(JSON.stringify({ received_bytes: 262_144 }), { status: 200 });
      }
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await testInternetSpeed({
      minDownloadMbps: 0,
      minUploadMbps: 0,
      maxPingMs: 10_000,
    });

    expect(result.passed).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(9);
    expect(fetchMock.mock.calls.every(([url]) => String(url).startsWith("http://localhost:3001/api/v1/"))).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => /google|jsdelivr|unpkg|httpbin|postman-echo/.test(String(url)))).toBe(false);
  });

  it("fails closed when the interview API cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const result = await testInternetSpeed(DEFAULT_THRESHOLDS);
    expect(result).toMatchObject({ passed: false, download: 0, upload: 0, ping: 999 });
  });
});
