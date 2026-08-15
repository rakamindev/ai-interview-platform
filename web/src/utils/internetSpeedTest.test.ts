import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWithTimeout } from "@/utils/internetSpeedTest";

describe("fetchWithTimeout (P2-8)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("aborts a stalled fetch after the timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, opts: RequestInit) =>
          new Promise((_resolve, reject) => {
            opts.signal?.addEventListener("abort", () => {
              const err = new Error("aborted");
              err.name = "AbortError";
              reject(err);
            });
          }),
      ),
    );

    const promise = fetchWithTimeout("https://example.test", {}, 1000);
    const assertion = expect(promise).rejects.toThrow(/aborted/);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("resolves normally when fetch returns before the timeout", async () => {
    const response = new Response("ok");
    vi.stubGlobal("fetch", vi.fn(async () => response));

    await expect(fetchWithTimeout("https://example.test", {}, 1000)).resolves.toBe(response);
  });
});
