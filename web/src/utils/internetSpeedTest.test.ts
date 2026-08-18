import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_THRESHOLDS,
  metOrUnknown,
  shortfalls,
  type InternetSpeedResult,
} from "./internetSpeedTest";

const result = (o: Partial<InternetSpeedResult> = {}): InternetSpeedResult => ({
  download: 10,
  upload: 5,
  ping: 40,
  passed: true,
  incomplete: false,
  downloadTests: [],
  uploadTests: [],
  pingTests: [],
  ...o,
});

describe("DEFAULT_THRESHOLDS", () => {
  // The stream needs 0.256 up and 0.384 down. The gate wants headroom over that,
  // not orders of magnitude — it was 8/4, which turned away usable connections.
  it("asks for more than the stream needs, as headroom", () => {
    expect(DEFAULT_THRESHOLDS.minUploadMbps).toBeGreaterThan(0.256);
    expect(DEFAULT_THRESHOLDS.minDownloadMbps).toBeGreaterThan(0.384);
  });

  // Published guidance for audio-only assessment: 1 Mbps each way as the floor,
  // 2 Mbps comfortable. Above that we exclude candidates we could have served.
  it("stays within the range published guidance considers comfortable", () => {
    expect(DEFAULT_THRESHOLDS.minUploadMbps).toBeLessThanOrEqual(2);
    expect(DEFAULT_THRESHOLDS.minDownloadMbps).toBeLessThanOrEqual(2);
  });

  // ITU-T G.114 calls under 150 ms one-way good for conversation, and the model
  // generating its reply dominates anyway. 100 ms would exclude mobile for
  // nothing the candidate would hear.
  it("allows latency a spoken conversation tolerates", () => {
    expect(DEFAULT_THRESHOLDS.maxPingMs).toBe(300);
  });
});

describe("metOrUnknown", () => {
  it("passes a value at or above the minimum", () => {
    expect(metOrUnknown(2, 2)).toBe(true);
  });

  it("fails a value below the minimum", () => {
    expect(metOrUnknown(1.9, 2)).toBe(false);
  });

  // An unmeasured metric is not evidence against the candidate.
  it("does not fail a metric that was never measured", () => {
    expect(metOrUnknown(null, 2)).toBe(true);
  });
});

describe("shortfalls", () => {
  it("is empty when the connection is fine", () => {
    expect(shortfalls(result())).toEqual([]);
  });

  it("names the measurement and what was needed, so the candidate can act", () => {
    const lines = shortfalls(result({ upload: 1 }));

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("1 Mbps");
    expect(lines[0]).toContain(`${DEFAULT_THRESHOLDS.minUploadMbps} Mbps`);
  });

  it("reports latency that is too high", () => {
    expect(shortfalls(result({ ping: 900 }))[0]).toMatch(/latency/i);
  });

  it("lists every metric that fell short", () => {
    expect(shortfalls(result({ download: 1, upload: 0.5, ping: 900 }))).toHaveLength(3);
  });

  // Silence about an unmeasured metric beats inventing a shortfall for it.
  it("says nothing about a metric that could not be measured", () => {
    expect(shortfalls(result({ upload: null }))).toEqual([]);
  });
});

describe("testInternetSpeed", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test/api/v1");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  async function runWith(fetchImpl: typeof fetch) {
    globalThis.fetch = fetchImpl;
    const { testInternetSpeed } = await import("./internetSpeedTest");
    return testInternetSpeed();
  }

  // Upload used to POST half a megabyte to httpbin.org, an undisclosed third
  // party, and measured how busy that service was.
  it("uploads to our own API, not a third-party echo service", async () => {
    const seen: string[] = [];
    await runWith((async (url: any, init: any) => {
      seen.push(String(url));
      if (init?.method === "POST") return new Response("{}", { status: 200 });
      return new Response("x", { status: 200, headers: { "content-length": "1" } });
    }) as typeof fetch);

    const posted = seen.filter((u) => u.includes("speed_test"));
    expect(posted.length).toBeGreaterThan(0);
    expect(seen.some((u) => u.includes("httpbin") || u.includes("postman-echo"))).toBe(false);
  });

  // Used to return a hardcoded 0.5 Mbps when every endpoint failed, and that
  // invented figure then decided whether someone could be interviewed.
  describe("when nothing can be reached", () => {
    it("reports null rather than inventing a number", async () => {
      const res = await runWith((async () => {
        throw new Error("offline");
      }) as typeof fetch);

      expect(res.upload).toBeNull();
      expect(res.download).toBeNull();
      expect(res.ping).toBeNull();
    });

    it("marks the result incomplete", async () => {
      const res = await runWith((async () => {
        throw new Error("offline");
      }) as typeof fetch);

      expect(res.incomplete).toBe(true);
    });

    it("does not pass on the strength of measurements it never took", async () => {
      const res = await runWith((async () => {
        throw new Error("offline");
      }) as typeof fetch);

      expect(res.passed).toBe(false);
    });
  });

  it("does not pass when a metric is missing, even if the others are fine", async () => {
    const res = await runWith((async (url: any, init: any) => {
      if (init?.method === "POST") throw new Error("upload blocked");
      return new Response("x".repeat(1024), {
        status: 200,
        headers: { "content-length": "1048576" },
      });
    }) as typeof fetch);

    expect(res.download).not.toBeNull();
    expect(res.upload).toBeNull();
    expect(res.passed).toBe(false);
    expect(res.incomplete).toBe(true);
  });
});
