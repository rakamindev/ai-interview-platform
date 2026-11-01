import { afterEach, describe, expect, it, vi } from "vitest";

import { testInternetSpeed } from "@/utils/internetSpeedTest";

describe("testInternetSpeed", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("fails instead of hanging when every endpoint stops responding", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
          }),
      ),
    );

    const pending = testInternetSpeed();
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result.passed).toBe(false);
    expect(result.ping).toBe(999);
  });

  it("measures upload against the API speed_test endpoint, not a public echo service", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/api/v1");
    vi.resetModules();
    const { testInternetSpeed: runWithApiUrl } = await import("@/utils/internetSpeedTest");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await runWithApiUrl();

    const uploadUrls = fetchMock.mock.calls
      .filter(([, init]) => init?.method === "POST")
      .map(([url]) => url);
    expect(uploadUrls).toEqual(Array(3).fill("https://api.example.test/api/v1/speed_test"));
  });
});
