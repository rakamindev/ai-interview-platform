import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_THRESHOLDS, DOWNLOAD_TEST_BYTES, UPLOAD_TEST_BYTES, testInternetSpeed } from "./internetSpeedTest";

// Hosts the pre-flight check used to call before it measured against the API
// origin. The production CSP blocks all of them, which made every candidate
// fail the pre-flight check.
const FORMER_THIRD_PARTY_HOSTS = ["google.com", "jsdelivr.net", "unpkg.com", "httpbin.org", "postman-echo.com"];

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function downloadResponse(): Response {
    return new Response(new ArrayBuffer(DOWNLOAD_TEST_BYTES), { status: 200 });
}

/** Stubs fetch with a healthy API: all three endpoints answer. */
function stubHealthyApi() {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push(url);
        if (url.includes("/speed_test/download")) return downloadResponse();
        if (url.includes("/health")) return jsonResponse({ status: "ok" });
        const payload = init?.body as Blob;
        return jsonResponse({ received_bytes: payload.size });
    });
    vi.stubGlobal("fetch", fetchMock);
    return { calls, fetchMock };
}

describe("testInternetSpeed", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("requires 2 Mbps down, 1 Mbps up and under 300 ms", () => {
        expect(DEFAULT_THRESHOLDS).toEqual({ minDownloadMbps: 2, minUploadMbps: 1, maxPingMs: 300 });
    });

    it("only calls the interview API, never third-party hosts", async () => {
        const { calls } = stubHealthyApi();

        await testInternetSpeed();

        expect(calls.some((url) => url.includes("/speed_test/download"))).toBe(true);
        expect(calls.filter((url) => url.includes("/health")).length).toBeGreaterThan(0);
        for (const host of FORMER_THIRD_PARTY_HOSTS) {
            expect(calls.some((url) => url.includes(host))).toBe(false);
        }
    });

    it("passes when every measurement succeeds", async () => {
        stubHealthyApi();

        const result = await testInternetSpeed();

        expect(result.passed).toBe(true);
        expect(result.download).toBeGreaterThan(0);
        expect(result.upload).toBeGreaterThan(0);
        expect(result.ping).toBeLessThanOrEqual(300);
        expect(result.downloadTests).toHaveLength(3);
        expect(result.uploadTests).toHaveLength(3);
        expect(result.pingTests).toHaveLength(3);
    });

    it("fails when a measurement stays below the required threshold", async () => {
        stubHealthyApi();

        const result = await testInternetSpeed({ minDownloadMbps: 1_000_000, minUploadMbps: 1, maxPingMs: 300 });

        expect(result.passed).toBe(false);
        expect(result.unreachable).toBe(false);
    });

    it("fails closed when the API is unreachable", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

        const result = await testInternetSpeed();

        expect(result.passed).toBe(false);
        expect(result.download).toBe(0);
        expect(result.upload).toBe(0);
        expect(result.ping).toBe(999);
        expect(result.unreachable).toBe(true);
        expect(result.downloadTests).toEqual([]);
        expect(result.uploadTests).toEqual([]);
        expect(result.pingTests).toEqual([]);
    });

    it("does not fabricate an upload measurement when uploads fail", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async (input: RequestInfo | URL) => {
                const url = String(input);
                if (url.includes("/speed_test") && !url.includes("/download")) {
                    throw new Error("upload blocked");
                }
                if (url.includes("/speed_test/download")) return downloadResponse();
                return jsonResponse({ status: "ok" });
            })
        );

        const result = await testInternetSpeed();

        expect(result.upload).toBe(0);
        expect(result.uploadTests).toEqual([]);
        expect(result.passed).toBe(false);
        expect(result.unreachable).toBe(false);
    });

    it("rejects an upload the API did not fully receive", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async (input: RequestInfo | URL) => {
                const url = String(input);
                if (url.includes("/speed_test/download")) return downloadResponse();
                if (url.includes("/health")) return jsonResponse({ status: "ok" });
                return jsonResponse({ received_bytes: UPLOAD_TEST_BYTES - 1 });
            })
        );

        const result = await testInternetSpeed();

        expect(result.upload).toBe(0);
        expect(result.passed).toBe(false);
    });
});
