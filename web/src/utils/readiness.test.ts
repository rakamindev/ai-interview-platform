import { describe, expect, it, vi } from "vitest";
import { AUDIO_NEEDS, THRESHOLDS, assessNetwork, measureNetwork } from "./readiness";

describe("assessNetwork", () => {
    it("derives the hard minimum from what the interview audio actually needs", () => {
        // 16 kHz × 16-bit mono mic = 0.256 Mbps up; 24 kHz × 16-bit AI voice = 0.384 Mbps down
        expect(AUDIO_NEEDS.uploadMbps).toBeCloseTo(0.256);
        expect(AUDIO_NEEDS.downloadMbps).toBeCloseTo(0.384);
        expect(THRESHOLDS.fail.uploadMbps).toBeGreaterThan(AUDIO_NEEDS.uploadMbps);
        expect(THRESHOLDS.fail.downloadMbps).toBeGreaterThan(AUDIO_NEEDS.downloadMbps);
    });

    it("passes a good connection", () => {
        const result = assessNetwork({ downloadMbps: 78.5, uploadMbps: 31.7, latencyMs: 11 });
        expect(result.verdict).toBe("pass");
    });

    it("lets a weak but workable mobile connection through with a warning instead of blocking", () => {
        // Real reading from the case study: the old check blocked this candidate.
        const result = assessNetwork({ downloadMbps: 12.22, uploadMbps: 0.4, latencyMs: 393 });
        expect(result.verdict).toBe("warn");
        expect(result.reasons.join(" ")).toMatch(/upload/i);
    });

    it("fails when upload is below what the microphone stream needs", () => {
        expect(assessNetwork({ downloadMbps: 20, uploadMbps: 0.2, latencyMs: 50 }).verdict).toBe("fail");
    });

    it("fails when latency would make the conversation unusable", () => {
        expect(assessNetwork({ downloadMbps: 20, uploadMbps: 5, latencyMs: 2000 }).verdict).toBe("fail");
    });

    it("never passes when a measurement could not be taken", () => {
        // Regression: the old fallback turned a failed upload test into exactly the pass threshold.
        const result = assessNetwork({ downloadMbps: 50, uploadMbps: null, latencyMs: 20 });
        expect(result.verdict).toBe("warn");
        expect(result.measured).toBe(false);
    });

    it("fails when the interview server could not be reached at all", () => {
        const result = assessNetwork({ downloadMbps: null, uploadMbps: null, latencyMs: null });
        expect(result.verdict).toBe("fail");
        expect(result.reasons.join(" ")).toMatch(/reach/i);
    });
});

type Call = { url: string; method: string };

/**
 * Fake fetch on a fake clock: every request "takes" `ms` of simulated time.
 * Tracks concurrency so we can assert the probes never compete for bandwidth.
 */
function fakeNetwork(ms: { ping: number; download: number; upload: number }, downloadBytes = 262_144) {
    let clock = 0;
    let inFlight = 0;
    let maxInFlight = 0;
    const calls: Call[] = [];

    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        calls.push({ url, method });
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        try {
            if (url.endsWith("/connectivity/ping")) {
                clock += ms.ping;
                return new Response(null, { status: 204 });
            }
            if (url.endsWith("/connectivity/download")) {
                clock += ms.download;
                return new Response(new Uint8Array(downloadBytes), { status: 200 });
            }
            if (url.endsWith("/connectivity/upload")) {
                clock += ms.upload;
                const sent = (init?.body as Blob).size;
                return new Response(JSON.stringify({ received_bytes: sent }), { status: 200 });
            }
            return new Response(null, { status: 404 });
        } finally {
            inFlight -= 1;
        }
    });

    return { fetchImpl, now: () => clock, calls, maxInFlight: () => maxInFlight };
}

describe("measureNetwork", () => {
    const baseUrl = "http://api.test/api/v1";

    it("measures only against our own API, never third-party services", async () => {
        const net = fakeNetwork({ ping: 40, download: 200, upload: 400 });

        await measureNetwork({ baseUrl, fetchImpl: net.fetchImpl, now: net.now });

        expect(net.calls.length).toBeGreaterThan(0);
        for (const call of net.calls) expect(call.url.startsWith(baseUrl)).toBe(true);
    });

    it("runs the probes one at a time so they do not compete for bandwidth", async () => {
        const net = fakeNetwork({ ping: 40, download: 200, upload: 400 });

        await measureNetwork({ baseUrl, fetchImpl: net.fetchImpl, now: net.now });

        expect(net.maxInFlight()).toBe(1);
    });

    it("turns transfer time into Mbps using the bytes actually moved", async () => {
        // 262144 B in 200 ms down = 10.49 Mbps; the upload blob (262144 B) in 400 ms = 5.24 Mbps
        const net = fakeNetwork({ ping: 40, download: 200, upload: 400 });

        const sample = await measureNetwork({ baseUrl, fetchImpl: net.fetchImpl, now: net.now });

        expect(sample.latencyMs).toBe(40);
        expect(sample.downloadMbps).toBeCloseTo(10.49, 1);
        expect(sample.uploadMbps).toBeCloseTo(5.24, 1);
    });

    it("gives up on a hung request after its timeout and reports it as unmeasured", async () => {
        vi.useFakeTimers();
        try {
            const hanging = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
                }),
            );
            const timeouts = { pingMs: 1_000, downloadMs: 2_000, uploadMs: 3_000 };

            const pending = measureNetwork({ baseUrl, fetchImpl: hanging, timeouts });
            await vi.advanceTimersByTimeAsync(30_000);
            const sample = await pending;

            expect(sample).toEqual({ downloadMbps: null, uploadMbps: null, latencyMs: null });
        } finally {
            vi.useRealTimers();
        }
    });

    it("treats an error response as unmeasured rather than as a speed", async () => {
        const failing = vi.fn(async () => new Response(null, { status: 503 }));

        const sample = await measureNetwork({ baseUrl, fetchImpl: failing, now: () => 0 });

        expect(sample).toEqual({ downloadMbps: null, uploadMbps: null, latencyMs: null });
    });
});
