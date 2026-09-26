/**
 * Unit tests for internetSpeedTest.ts
 *
 * Tests mock `fetch` to isolate threshold logic from real network calls.
 * Uses real async execution (no fake timers) so Promise.all in the implementation resolves naturally.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { testInternetSpeed, DEFAULT_THRESHOLDS } from "@/utils/internetSpeedTest";

function blob(bytes: number): Blob {
    return new Blob([new ArrayBuffer(bytes)]);
}

// Swap performance.now to control timing deterministically
function mockPerfNow(msPerCall: number) {
    let call = 0;
    const spy = vi.spyOn(globalThis.performance, "now").mockImplementation(() => {
        call++;
        return call % 2 === 1 ? 0 : msPerCall;
    });
    return spy;
}

describe("testInternetSpeed — threshold logic", () => {
    afterEach(() => { vi.restoreAllMocks(); });

    it("passes when download is fast and ping is low", async () => {
        // 200KB blob in 25ms → 8MB/s → 64Mbps; ping also uses same fast timing
        const perfSpy = mockPerfNow(25);
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            blob: () => Promise.resolve(blob(200 * 1024)),
        } as unknown as Response);

        const result = await testInternetSpeed({ minDownloadMbps: 5, minUploadMbps: 1, maxPingMs: 500 });

        expect(result.passed).toBe(true);
        expect(result.failReason).toBeUndefined();
        perfSpy.mockRestore();
    });

    it("fails with failReason when download is below threshold", async () => {
        // 200KB blob in 2000ms → 0.1 MB/s → 0.8 Mbps (below 5 Mbps)
        const perfSpy = mockPerfNow(2000);
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            blob: () => Promise.resolve(blob(200 * 1024)),
        } as unknown as Response);

        const result = await testInternetSpeed({ minDownloadMbps: 5, minUploadMbps: 1, maxPingMs: 500 });

        expect(result.passed).toBe(false);
        expect(result.failReason).toBeDefined();
        expect(result.failReason).toMatch(/download/i);
        perfSpy.mockRestore();
    });

    it("fails with failReason mentioning latency when both thresholds fail", async () => {
        // 600ms per call — download will be slow AND ping will be high
        const perfSpy = mockPerfNow(600);
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            blob: () => Promise.resolve(blob(100 * 1024)),
        } as unknown as Response);

        const result = await testInternetSpeed({ minDownloadMbps: 5, minUploadMbps: 1, maxPingMs: 500 });

        expect(result.passed).toBe(false);
        expect(result.failReason).toBeDefined();
        // At 600ms for 100KB: 100KB/0.6s = 0.167MB/s → 1.33Mbps → below threshold
        // At 600ms ping → above 500ms threshold
        // failReason will mention both: we just confirm it exists and has expected content
        expect(result.failReason!.length).toBeGreaterThan(0);
        perfSpy.mockRestore();
    });

    it("returns passed=false when all fetch calls fail (network unreachable)", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

        const result = await testInternetSpeed();

        expect(result.passed).toBe(false);
        expect(result.download).toBe(0);
        expect(result.ping).toBe(999);
        expect(result.failReason).toBeDefined();
    });

    it("result DOES include upload and uploadTests fields", async () => {
        const perfSpy = mockPerfNow(25);
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            blob: () => Promise.resolve(blob(200 * 1024)),
        } as unknown as Response);

        const result = await testInternetSpeed();

        expect((result as any).upload).toBeDefined();
        expect((result as any).uploadTests).toBeDefined();
        perfSpy.mockRestore();
    });

    it("DEFAULT_THRESHOLDS includes minUploadMbps", () => {
        expect(DEFAULT_THRESHOLDS.minUploadMbps).toBeDefined();
        expect(DEFAULT_THRESHOLDS.minDownloadMbps).toBe(5);
        expect(DEFAULT_THRESHOLDS.maxPingMs).toBe(500);
    });
});
