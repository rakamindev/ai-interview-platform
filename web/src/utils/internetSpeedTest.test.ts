import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { testInternetSpeed } from "@/utils/internetSpeedTest";

/**
 * The point of these tests is not the arithmetic — it is the guest list.
 *
 * This runs in a candidate's browser seconds before an interview, from a
 * consent screen that names exactly who receives their data. Any host that
 * appears here and not in that notice is an undisclosed disclosure the
 * candidate had no chance to refuse.
 */

const THIRD_PARTIES = [
  "google.com",
  "jsdelivr.net",
  "unpkg.com",
  "httpbin.org",
  "postman-echo.com",
];

function hostsCalledBy(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input));
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(512 * 1024),
  })) as unknown as ReturnType<typeof vi.fn>;
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("testInternetSpeed", () => {
  it("never contacts a third party", async () => {
    await testInternetSpeed();

    const urls = hostsCalledBy(fetchMock);
    expect(urls.length).toBeGreaterThan(0);

    for (const url of urls) {
      for (const host of THIRD_PARTIES) {
        expect(url).not.toContain(host);
      }
    }
  });

  it("measures against this application's own API", async () => {
    await testInternetSpeed();

    const urls = hostsCalledBy(fetchMock);
    expect(urls.some((u) => u.includes("/speed_test"))).toBe(true);
    expect(urls.some((u) => u.includes("/health"))).toBe(true);
  });

  it("defeats caching, or it would be timing a memory read", async () => {
    await testInternetSpeed();

    for (const url of hostsCalledBy(fetchMock)) {
      expect(url).toMatch(/[?&]_=/);
    }
  });

  it("reports a failure as a failure rather than a plausible number", async () => {
    // The old implementation fell back to 0.5 MB/s when every endpoint refused,
    // so a candidate who could not reach us at all was told their line was fine.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    const result = await testInternetSpeed();

    expect(result.download).toBe(0);
    expect(result.upload).toBe(0);
    expect(result.passed).toBe(false);
  });

  it("derives the speed from the bytes that arrived, not the bytes requested", async () => {
    // A proxy that truncates the payload takes the same time to answer but
    // delivers far less, and must be reported as the slower line it is.
    const respondingWith = (bytes: number) =>
      vi.fn(async (input: unknown) => {
        await new Promise((r) => setTimeout(r, 20));
        return {
          ok: true,
          arrayBuffer: async () =>
            new ArrayBuffer(String(input).includes("speed_test") ? bytes : 0),
        };
      });

    vi.stubGlobal("fetch", respondingWith(512 * 1024));
    const full = await testInternetSpeed();

    vi.stubGlobal("fetch", respondingWith(4 * 1024));
    const truncated = await testInternetSpeed();

    expect(truncated.download).toBeLessThan(full.download / 10);
  });

  it("fails a line that cannot carry an interview", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 400));
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(4 * 1024) };
      }),
    );

    const result = await testInternetSpeed();

    expect(result.passed).toBe(false);
  });
});
