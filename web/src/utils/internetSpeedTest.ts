// Internet Speed Test Utilities — measures entirely against this app's own
// backend (no third-party CDN/API dependency). Latency and jitter are measured
// over a real WebSocket round trip on the same transport stack used by the
// actual interview audio connection (ws://.../ws/speed_test — echo-only, no
// session/Gemini side effects). Throughput is measured over the same-origin
// HTTP speed_test endpoints.

export interface InternetSpeedResult {
    download: number;
    upload: number;
    ping: number;
    /** Mean absolute difference between consecutive ping samples — the metric that actually predicts choppy audio. */
    jitter: number;
    passed: boolean;
    /** Set when the test itself couldn't run (timeout, server unreachable) — distinct from a genuinely poor connection. */
    error?: string;
    downloadTests: number[];
    uploadTests: number[];
    pingTests: number[];
}

export interface SpeedThresholds {
    minDownloadMbps: number;
    minUploadMbps: number;
    maxPingMs: number;
    maxJitterMs: number;
}

// This gates a voice-only interview over a WebSocket, not a video call.
// Latency and jitter — not raw throughput — are what predict a choppy call,
// so they carry the pass/fail decision; the Mbps figures are a sanity floor.
export const DEFAULT_THRESHOLDS: SpeedThresholds = {
    minDownloadMbps: 1,
    minUploadMbps: 0.3,
    maxPingMs: 300,
    maxJitterMs: 100,
};

const PER_REQUEST_TIMEOUT_MS = 4000;
const OVERALL_TIMEOUT_MS = 10000;
const PING_SAMPLE_COUNT = 5;

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3000/api/v1";
const WS_BASE_URL = (import.meta.env.VITE_WS_BASE_URL as string | undefined) ?? "ws://localhost:3000";

async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs = PER_REQUEST_TIMEOUT_MS
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Opens one WebSocket to the ping-echo endpoint and sends PING_SAMPLE_COUNT
 * timestamped messages, one at a time, measuring round-trip time for each.
 * This is the same transport (Puma + EventMachine + faye-websocket) the real
 * audio connection uses — the echo endpoint itself does nothing but bounce
 * the message back, so no interview/session state is touched.
 */
function measureWsLatency(): Promise<number[]> {
    return new Promise((resolve) => {
        const samples: number[] = [];
        let settled = false;
        let ws: WebSocket;

        const finish = () => {
            if (settled) return;
            settled = true;
            try {
                ws.close();
            } catch {
                // already closed
            }
            resolve(samples);
        };

        const timer = setTimeout(finish, OVERALL_TIMEOUT_MS - 1000);

        try {
            ws = new WebSocket(`${WS_BASE_URL}/ws/speed_test`);
        } catch (err) {
            console.warn("[speedTest] could not open ping WebSocket", err);
            clearTimeout(timer);
            finish();
            return;
        }

        let sent = 0;
        const sendNext = () => {
            if (sent >= PING_SAMPLE_COUNT) {
                clearTimeout(timer);
                finish();
                return;
            }
            sent += 1;
            ws.send(String(performance.now()));
        };

        ws.onopen = () => sendNext();

        ws.onmessage = (event) => {
            const sentAt = Number(event.data);
            if (Number.isFinite(sentAt)) samples.push(performance.now() - sentAt);
            sendNext();
        };

        ws.onerror = (err) => {
            console.warn("[speedTest] ping WebSocket error", err);
            clearTimeout(timer);
            finish();
        };

        ws.onclose = () => {
            clearTimeout(timer);
            finish();
        };
    });
}

async function measureDownloadSpeed(): Promise<number | null> {
    const sizeBytes = 200_000;
    try {
        const start = performance.now();
        const response = await fetchWithTimeout(`${API_BASE_URL}/speed_test?size=${sizeBytes}`, {
            cache: "no-cache",
        });
        if (!response.ok) return null;
        await response.blob();
        const seconds = (performance.now() - start) / 1000;
        return sizeBytes / 1_000_000 / seconds; // MB/s
    } catch (err) {
        console.warn("[speedTest] download probe failed", err);
        return null;
    }
}

async function measureUploadSpeed(): Promise<number | null> {
    const sizeBytes = 100_000;
    const uploadData = new Blob([new ArrayBuffer(sizeBytes)], { type: "application/octet-stream" });
    try {
        const start = performance.now();
        await fetchWithTimeout(`${API_BASE_URL}/speed_test`, {
            method: "POST",
            body: uploadData,
        });
        const seconds = (performance.now() - start) / 1000;
        return sizeBytes / 1_000_000 / seconds; // MB/s
    } catch (err) {
        console.warn("[speedTest] upload probe failed", err);
        return null;
    }
}

async function runMultipleTests<T>(testFn: () => Promise<T | null>, count = 3): Promise<T[]> {
    const results: T[] = [];
    for (let i = 0; i < count; i++) {
        const result = await testFn();
        if (result !== null) results.push(result);
        await new Promise((r) => setTimeout(r, 100));
    }
    return results;
}

function average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

/** RFC 3550-style interarrival jitter: mean absolute change between consecutive samples. */
function meanJitter(values: number[]): number {
    if (values.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < values.length; i++) total += Math.abs(values[i] - values[i - 1]);
    return total / (values.length - 1);
}

async function runSpeedTest(thresholds: SpeedThresholds): Promise<InternetSpeedResult> {
    const pingTests = await measureWsLatency();
    const downloadTests = await runMultipleTests(measureDownloadSpeed, 3);
    const uploadTests = await runMultipleTests(measureUploadSpeed, 3);

    const downloadTestsMbps = downloadTests.map((v) => Math.round(v * 8 * 100) / 100);
    const uploadTestsMbps = uploadTests.map((v) => Math.round(v * 8 * 100) / 100);
    const pingTestsMs = pingTests.map((v) => Math.round(v));

    // Any metric with zero successful samples means the backend itself was
    // unreachable — that's an infrastructure problem, not a verdict on the
    // candidate's connection, so it's surfaced as an error, not a 0/999 reading.
    if (downloadTests.length === 0 || uploadTests.length === 0 || pingTests.length === 0) {
        return {
            download: Math.round(average(downloadTests) * 8 * 100) / 100,
            upload: Math.round(average(uploadTests) * 8 * 100) / 100,
            ping: pingTests.length ? Math.round(average(pingTests)) : 999,
            jitter: Math.round(meanJitter(pingTests)),
            passed: false,
            error: "Couldn't reach the interview server — this looks like a server or firewall issue, not necessarily your connection.",
            downloadTests: downloadTestsMbps,
            uploadTests: uploadTestsMbps,
            pingTests: pingTestsMs,
        };
    }

    const downloadMbps = average(downloadTests) * 8;
    const uploadMbps = average(uploadTests) * 8;
    const ping = average(pingTests);
    const jitter = meanJitter(pingTests);

    const passed =
        downloadMbps >= thresholds.minDownloadMbps &&
        uploadMbps >= thresholds.minUploadMbps &&
        ping <= thresholds.maxPingMs &&
        jitter <= thresholds.maxJitterMs;

    return {
        download: Math.round(downloadMbps * 100) / 100,
        upload: Math.round(uploadMbps * 100) / 100,
        ping: Math.round(ping),
        jitter: Math.round(jitter),
        passed,
        downloadTests: downloadTestsMbps,
        uploadTests: uploadTestsMbps,
        pingTests: pingTestsMs,
    };
}

export async function testInternetSpeed(
    thresholds: SpeedThresholds = DEFAULT_THRESHOLDS
): Promise<InternetSpeedResult> {
    // Hard ceiling on top of the per-request timeouts above: guarantees this
    // promise always settles, even if something upstream still manages to hang.
    const overallTimeout = new Promise<InternetSpeedResult>((resolve) => {
        setTimeout(
            () =>
                resolve({
                    download: 0,
                    upload: 0,
                    ping: 999,
                    jitter: 999,
                    passed: false,
                    error: `Speed test timed out after ${OVERALL_TIMEOUT_MS / 1000}s. Check your connection and try again.`,
                    downloadTests: [],
                    uploadTests: [],
                    pingTests: [],
                }),
            OVERALL_TIMEOUT_MS
        );
    });

    try {
        return await Promise.race([runSpeedTest(thresholds), overallTimeout]);
    } catch (err) {
        console.error("[speedTest] unexpected error", err);
        return {
            download: 0,
            upload: 0,
            ping: 999,
            jitter: 999,
            passed: false,
            error: err instanceof Error ? err.message : "Unexpected error while testing connection.",
            downloadTests: [],
            uploadTests: [],
            pingTests: [],
        };
    }
}
