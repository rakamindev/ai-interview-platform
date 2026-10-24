// Internet Speed Test Utilities — measures the candidate's connection to the
// interview API origin (the same host the interview itself uses).
//
// Third-party endpoints are deliberately not used: the production CSP only
// allows 'self' + the API origin (see web/vercel.json), and a transfer to an
// unrelated CDN would not reflect the path the interview actually takes.

import { API_URL } from "@/services/api";

export interface InternetSpeedResult {
    download: number;
    upload: number;
    ping: number;
    passed: boolean;
    // True when no probe of any kind succeeded (the server was never reached).
    // The UI must say "unreachable" instead of showing zeroes as if measured.
    unreachable: boolean;
    downloadTests: number[];
    uploadTests: number[];
    pingTests: number[];
}

export interface SpeedThresholds {
    minDownloadMbps: number;
    minUploadMbps: number;
    maxPingMs: number;
}

// Voice interviews need roughly 0.1 Mbps in each direction; the thresholds
// below keep ample headroom for jitter while staying reachable on ordinary
// home connections. Higher bars lock out candidates whose connection would
// actually have worked.
export const DEFAULT_THRESHOLDS: SpeedThresholds = {
    minDownloadMbps: 2,
    minUploadMbps: 1,
    maxPingMs: 300,
};

// One measurement round transfers this much data in each direction. The API
// caps download payloads at 2 MB.
export const DOWNLOAD_TEST_BYTES = 1_048_576; // 1 MiB
export const UPLOAD_TEST_BYTES = 1_048_576; // 1 MiB

// A stalled connection must not hang the pre-flight screen forever.
const DOWNLOAD_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 20_000;
const PING_TIMEOUT_MS = 5_000;

// Reported when no latency sample could be taken, so the UI fails the check
// instead of showing a misleading 0 ms.
const UNREACHABLE_PING_MS = 999;

const API_BASE = API_URL.replace(/\/+$/, "");

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function measurePing(): Promise<number> {
    const start = performance.now();
    const response = await fetchWithTimeout(`${API_BASE}/health`, { cache: "no-store" }, PING_TIMEOUT_MS);
    if (!response.ok) throw new Error(`health check failed: ${response.status}`);
    return performance.now() - start;
}

async function measureDownloadSpeed(): Promise<number> {
    const start = performance.now();
    const response = await fetchWithTimeout(
        `${API_BASE}/speed_test/download?bytes=${DOWNLOAD_TEST_BYTES}`,
        { cache: "no-store" },
        DOWNLOAD_TIMEOUT_MS
    );
    if (!response.ok) throw new Error(`download test failed: ${response.status}`);
    const payload = await response.arrayBuffer();
    const seconds = (performance.now() - start) / 1000;
    if (payload.byteLength === 0) throw new Error("download test returned no data");
    return payload.byteLength / seconds; // bytes per second
}

async function measureUploadSpeed(): Promise<number> {
    const payload = new Blob([new ArrayBuffer(UPLOAD_TEST_BYTES)], { type: "application/octet-stream" });
    const start = performance.now();
    const response = await fetchWithTimeout(
        `${API_BASE}/speed_test`,
        {
            method: "POST",
            body: payload,
            headers: { "Content-Type": "application/octet-stream" },
        },
        UPLOAD_TIMEOUT_MS
    );
    if (!response.ok) throw new Error(`upload test failed: ${response.status}`);
    const seconds = (performance.now() - start) / 1000;
    const { received_bytes: receivedBytes } = await response.json();
    // The API echoes what it actually received; a partial transfer must not be
    // reported as a successful measurement.
    if (receivedBytes !== UPLOAD_TEST_BYTES) throw new Error("upload test did not deliver the full payload");
    return UPLOAD_TEST_BYTES / seconds; // bytes per second
}

async function runMultipleTests<T>(testFn: () => Promise<T>, count = 3): Promise<T[]> {
    const results: T[] = [];
    for (let i = 0; i < count; i++) {
        try {
            results.push(await testFn());
            await new Promise((r) => setTimeout(r, 100));
        } catch {
            // Failed samples are skipped, never fabricated: thresholds must be
            // judged on measurements that actually happened.
        }
    }
    return results;
}

function average(values: number[]): number {
    if (values.length === 0) return 0;
    if (values.length <= 2) return values.reduce((a, b) => a + b, 0) / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
    return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

function toMbps(bytesPerSecond: number): number {
    return (bytesPerSecond * 8) / 1_000_000;
}

export async function testInternetSpeed(
    thresholds: SpeedThresholds = DEFAULT_THRESHOLDS
): Promise<InternetSpeedResult> {
    try {
        const [downloadTests, uploadTests, pingTests] = await Promise.all([
            runMultipleTests(measureDownloadSpeed, 3),
            runMultipleTests(measureUploadSpeed, 3),
            runMultipleTests(measurePing, 3),
        ]);

        const downloadMbps = toMbps(average(downloadTests));
        const uploadMbps = toMbps(average(uploadTests));
        const ping = pingTests.length > 0 ? average(pingTests) : UNREACHABLE_PING_MS;

        const passed =
            downloadTests.length > 0 &&
            uploadTests.length > 0 &&
            pingTests.length > 0 &&
            downloadMbps >= thresholds.minDownloadMbps &&
            uploadMbps >= thresholds.minUploadMbps &&
            ping <= thresholds.maxPingMs;

        const unreachable =
            downloadTests.length === 0 && uploadTests.length === 0 && pingTests.length === 0;

        return {
            download: Math.round(downloadMbps * 100) / 100,
            upload: Math.round(uploadMbps * 100) / 100,
            ping: Math.round(ping),
            passed,
            unreachable,
            downloadTests: downloadTests.map((v) => Math.round(toMbps(v) * 100) / 100),
            uploadTests: uploadTests.map((v) => Math.round(toMbps(v) * 100) / 100),
            pingTests: pingTests.map((v) => Math.round(v)),
        };
    } catch {
        return {
            download: 0,
            upload: 0,
            ping: UNREACHABLE_PING_MS,
            passed: false,
            unreachable: true,
            downloadTests: [],
            uploadTests: [],
            pingTests: [],
        };
    }
}
