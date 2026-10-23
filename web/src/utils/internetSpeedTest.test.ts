import { describe, expect, it } from "vitest";
import { testInternetSpeed, DEFAULT_THRESHOLDS, type SpeedTestDeps } from "./internetSpeedTest";

const BASE = "http://api.test/api/v1";

interface FakeServerOptions {
    pingMs?: number[];
    downloadMs?: number[];
    uploadMs?: number[];
    status?: number;
    unreachable?: boolean;
    shortBody?: boolean;
    hang?: "ping" | "download" | "upload";
}

// A fake API with its own clock: each request advances time by the configured
// duration, so throughput is deterministic and no test actually waits.
function fakeServer(opts: FakeServerOptions = {}) {
    let clock = 0;
    let inFlight = 0;
    let maxInFlight = 0;
    const counters = { ping: 0, download: 0, upload: 0 };

    const pick = (list: number[] | undefined, i: number, fallback: number) =>
        list ? list[Math.min(i, list.length - 1)] : fallback;

    const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
        const url = new URL(String(input));
        const kind = url.pathname.endsWith("/health")
            ? "ping"
            : init.method === "POST"
              ? "upload"
              : "download";

        if (opts.unreachable) throw new TypeError("Failed to fetch");

        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        try {
            if (opts.hang === kind) {
                await new Promise((_, reject) =>
                    init.signal?.addEventListener("abort", () =>
                        reject(new DOMException("aborted", "AbortError"))
                    )
                );
            }

            const i = counters[kind]++;
            if (kind === "ping") clock += pick(opts.pingMs, i, 40);
            if (kind === "download") clock += pick(opts.downloadMs, i, 100);
            if (kind === "upload") clock += pick(opts.uploadMs, i, 100);

            const status = opts.status ?? 200;
            if (kind === "download" && status === 200) {
                const requested = Number(url.searchParams.get("bytes"));
                const bytes = opts.shortBody ? Math.floor(requested / 4) : requested;
                return new Response(new Uint8Array(bytes), { status });
            }
            return new Response("{}", { status });
        } finally {
            inFlight -= 1;
        }
    }) as typeof fetch;

    const deps: Partial<SpeedTestDeps> = {
        fetch: fetchImpl,
        now: () => clock,
        baseUrl: BASE,
        timeoutMs: 20,
    };
    return { deps, maxInFlight: () => maxInFlight };
}

describe("testInternetSpeed", () => {
    it("passes a healthy connection", async () => {
        const { deps } = fakeServer();

        const result = await testInternetSpeed(DEFAULT_THRESHOLDS, deps);

        expect(result.passed).toBe(true);
        expect(result.failures).toEqual([]);
        expect(result.error).toBeNull();
        expect(result.download).toBeGreaterThan(DEFAULT_THRESHOLDS.minDownloadMbps);
        expect(result.upload).toBeGreaterThan(DEFAULT_THRESHOLDS.minUploadMbps);
        expect(result.ping).toBe(40);
    });

    it("fails when upload is below the minimum", async () => {
        // 128 KiB in 4 s = 0.26 Mbps, under the 0.5 Mbps minimum
        const { deps } = fakeServer({ uploadMs: [4000] });

        const result = await testInternetSpeed(DEFAULT_THRESHOLDS, deps);

        expect(result.passed).toBe(false);
        expect(result.upload).toBeCloseTo(0.26, 2);
        expect(result.failures).toContain("Unggah 0,26 Mbps, minimal 0,5 Mbps");
    });

    it("fails when download is below the minimum", async () => {
        // 256 KiB in 4 s = 0.52 Mbps, under the 1 Mbps minimum
        const { deps } = fakeServer({ downloadMs: [4000] });

        const result = await testInternetSpeed(DEFAULT_THRESHOLDS, deps);

        expect(result.passed).toBe(false);
        expect(result.failures).toContain("Unduh 0,52 Mbps, minimal 1 Mbps");
    });

    it("fails when latency is above the maximum", async () => {
        const { deps } = fakeServer({ pingMs: [800] });

        const result = await testInternetSpeed(DEFAULT_THRESHOLDS, deps);

        expect(result.passed).toBe(false);
        expect(result.failures).toContain("Latensi 800 ms, maksimal 600 ms");
    });

    it("fails with a clear error when the server is unreachable", async () => {
        const { deps } = fakeServer({ unreachable: true });

        const result = await testInternetSpeed(DEFAULT_THRESHOLDS, deps);

        expect(result.passed).toBe(false);
        expect(result.error).toMatch(/tidak bisa dihubungi/);
    });

    it("fails when a request times out instead of reporting a made-up number", async () => {
        const { deps } = fakeServer({ hang: "upload" });

        const result = await testInternetSpeed(DEFAULT_THRESHOLDS, deps);

        expect(result.passed).toBe(false);
        expect(result.upload).toBeNull();
        expect(result.failures.some((f) => f.startsWith("Unggah tidak selesai"))).toBe(true);
    });

    it("fails when the latency probe times out", async () => {
        const { deps } = fakeServer({ hang: "ping" });

        const result = await testInternetSpeed(DEFAULT_THRESHOLDS, deps);

        expect(result.passed).toBe(false);
        expect(result.ping).toBeNull();
        expect(result.failures.some((f) => f.startsWith("Latensi tidak terukur"))).toBe(true);
    });

    it("fails when the server returns less data than requested instead of inflating the speed", async () => {
        const { deps } = fakeServer({ shortBody: true });

        const result = await testInternetSpeed(DEFAULT_THRESHOLDS, deps);

        expect(result.passed).toBe(false);
        expect(result.error).toMatch(/tidak lengkap/);
    });

    it("tells the candidate to wait when the probe is rate limited", async () => {
        const { deps } = fakeServer({ status: 429 });

        const result = await testInternetSpeed(DEFAULT_THRESHOLDS, deps);

        expect(result.passed).toBe(false);
        expect(result.error).toMatch(/Tunggu satu menit/);
    });

    it("ignores the warm-up ping, which pays for connection setup", async () => {
        const { deps } = fakeServer({ pingMs: [900, 40, 50, 45] });

        const result = await testInternetSpeed(DEFAULT_THRESHOLDS, deps);

        expect(result.ping).toBe(45);
        expect(result.passed).toBe(true);
    });

    it("uses the best throughput sample so one hiccup does not block the candidate", async () => {
        const { deps } = fakeServer({ uploadMs: [4000, 100] });

        const result = await testInternetSpeed(DEFAULT_THRESHOLDS, deps);

        expect(result.passed).toBe(true);
    });

    it("runs probes one at a time so they do not compete for bandwidth", async () => {
        const server = fakeServer();

        await testInternetSpeed(DEFAULT_THRESHOLDS, server.deps);

        expect(server.maxInFlight()).toBe(1);
    });
});
