import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_THRESHOLDS, testInternetSpeed } from "./internetSpeedTest";

describe("testInternetSpeed", () => {
    const originalFetch = globalThis.fetch;
    let now = 0;

    beforeEach(() => {
        now = 0;
        vi.spyOn(performance, "now").mockImplementation(() => {
            now += 100;
            return now;
        });
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("passes with local API fallback when external speed-test endpoints fail", async () => {
        globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.includes("localhost:3001/api/v1/health")) {
                return new Response("ok", { status: 200 });
            }

            if (url.includes("localhost:3001/api/v1/speed_test")) {
                return new Response("ok", { status: 200 });
            }

            throw new Error("external endpoint unavailable");
        });

        const result = await testInternetSpeed(DEFAULT_THRESHOLDS);

        expect(result.passed).toBe(true);
        expect(result.download).toBeGreaterThanOrEqual(DEFAULT_THRESHOLDS.minDownloadMbps);
        expect(result.upload).toBeGreaterThanOrEqual(DEFAULT_THRESHOLDS.minUploadMbps);
        expect(result.ping).toBeLessThanOrEqual(DEFAULT_THRESHOLDS.maxPingMs);
    });
});
