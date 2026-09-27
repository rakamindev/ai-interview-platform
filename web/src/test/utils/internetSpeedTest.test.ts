import { describe, it, expect, vi, beforeEach } from "vitest";
import { testInternetSpeed } from "@/utils/internetSpeedTest";

describe("internetSpeedTest (Advisory Connectivity Check)", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("uses internal endpoints /api/v1/health and /api/v1/speed_test for latency and upload measurement", async () => {
        const fetchCalls: string[] = [];

        (globalThis as any).fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
            const urlStr = url.toString();
            fetchCalls.push(urlStr);

            if (urlStr.includes("/api/v1/health")) {
                return Promise.resolve(new Response(JSON.stringify({ status: "ok" }), { status: 200 }));
            }
            if (urlStr.includes("/api/v1/speed_test")) {
                return Promise.resolve(new Response(JSON.stringify({ received_bytes: 524288 }), { status: 200 }));
            }
            return Promise.resolve(new Response(new Blob(["test data"]), { status: 200 }));
        });

        const result = await testInternetSpeed({
            minDownloadMbps: 1,
            minUploadMbps: 0.5,
            maxPingMs: 500,
        });

        // Verify calls to internal endpoints
        const hasHealthCall = fetchCalls.some((c) => c.includes("/api/v1/health"));
        const hasSpeedTestCall = fetchCalls.some((c) => c.includes("/api/v1/speed_test"));

        expect(hasHealthCall).toBe(true);
        expect(hasSpeedTestCall).toBe(true);

        // Verify that httpbin.org is NOT used
        const hasHttpBin = fetchCalls.some((c) => c.includes("httpbin.org"));
        expect(hasHttpBin).toBe(false);

        expect(result).toHaveProperty("ping");
        expect(result).toHaveProperty("jitter");
    });
});
