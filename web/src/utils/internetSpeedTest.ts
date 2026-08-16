// Internet Speed Test Utilities — standalone, no backend dependency

export interface InternetSpeedResult {
    download: number;
    upload: number;
    ping: number;
    passed: boolean;
    downloadTests: number[];
    uploadTests: number[];
    pingTests: number[];
}

export interface SpeedThresholds {
    minDownloadMbps: number;
    minUploadMbps: number;
    maxPingMs: number;
}

export const DEFAULT_THRESHOLDS: SpeedThresholds = {
    minDownloadMbps: 8,
    minUploadMbps: 4,
    maxPingMs: 300,
};

/**
 * Every measurement below runs against this application's own API.
 *
 * The earlier implementation timed requests to Google, jsDelivr, unpkg,
 * httpbin.org and postman-echo.com. That put a candidate's IP address and a
 * timestamp in front of five companies nobody named in the data-protection
 * notice they had just accepted, seconds before an interview — a disclosure
 * they were never asked about and could not decline.
 *
 * Measuring our own origin is also the more honest number: what matters is
 * whether the candidate's line can carry an interview with *this* service, not
 * how quickly a CDN edge node answers them.
 *
 * The two VITE_SPEED_TEST_* variables remain as an escape hatch for
 * deployments that terminate the media path somewhere other than the API.
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api/v1";

const PING_URL =
    (import.meta.env.VITE_SPEED_TEST_PING_URL as string | undefined) || `${API_BASE_URL}/health`;
const DOWNLOAD_URL = `${API_BASE_URL}/speed_test`;
const UPLOAD_URL =
    (import.meta.env.VITE_SPEED_TEST_UPLOAD_URL as string | undefined) || `${API_BASE_URL}/speed_test`;

const DOWNLOAD_BYTES = 512 * 1024;
const UPLOAD_BYTES = 512 * 1024;
const UNREACHABLE_PING_MS = 999;

/** Defeats any cache between here and the server without varying the path. */
function bust(url: string): string {
    return `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function measurePing(): Promise<number> {
    try {
        const start = performance.now();
        const res = await fetch(bust(PING_URL), { cache: "no-store" });
        if (!res.ok) return UNREACHABLE_PING_MS;
        await res.arrayBuffer();
        return performance.now() - start;
    } catch {
        return UNREACHABLE_PING_MS;
    }
}

/** Megabytes per second. Zero means the transfer never completed. */
async function measureDownloadSpeed(): Promise<number> {
    try {
        const start = performance.now();
        const res = await fetch(bust(`${DOWNLOAD_URL}?bytes=${DOWNLOAD_BYTES}`), { cache: "no-store" });
        if (!res.ok) return 0;

        // Measure the bytes that actually arrived rather than the bytes we
        // asked for: a proxy or a truncated response would otherwise be
        // reported as a fast line.
        const received = (await res.arrayBuffer()).byteLength;
        const seconds = (performance.now() - start) / 1000;
        if (seconds <= 0 || received === 0) return 0;

        return received / (1024 * 1024) / seconds;
    } catch {
        return 0;
    }
}

async function measureUploadSpeed(): Promise<number> {
    const payload = new Blob([new ArrayBuffer(UPLOAD_BYTES)], { type: "application/octet-stream" });

    try {
        const start = performance.now();
        const res = await fetch(bust(UPLOAD_URL), { method: "POST", body: payload });
        if (!res.ok) return 0;
        const seconds = (performance.now() - start) / 1000;
        if (seconds <= 0) return 0;

        return UPLOAD_BYTES / (1024 * 1024) / seconds;
    } catch {
        return 0;
    }
}

async function runMultipleTests<T>(testFn: () => Promise<T>, count = 3): Promise<T[]> {
    const results: T[] = [];
    for (let i = 0; i < count; i++) {
        try {
            results.push(await testFn());
            await new Promise((r) => setTimeout(r, 100));
        } catch {
            // skip failed test
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

export async function testInternetSpeed(
    thresholds: SpeedThresholds = DEFAULT_THRESHOLDS
): Promise<InternetSpeedResult> {
    try {
        const [downloadTests, uploadTests, pingTests] = await Promise.all([
            runMultipleTests(measureDownloadSpeed, 3),
            runMultipleTests(measureUploadSpeed, 3),
            runMultipleTests(measurePing, 3),
        ]);

        const downloadMbps = average(downloadTests) * 8;
        const uploadMbps = average(uploadTests) * 8;
        const ping = average(pingTests);

        const passed =
            downloadMbps >= thresholds.minDownloadMbps &&
            uploadMbps >= thresholds.minUploadMbps &&
            ping <= thresholds.maxPingMs;

        return {
            download: Math.round(downloadMbps * 100) / 100,
            upload: Math.round(uploadMbps * 100) / 100,
            ping: Math.round(ping),
            passed,
            downloadTests: downloadTests.map((v) => Math.round(v * 8 * 100) / 100),
            uploadTests: uploadTests.map((v) => Math.round(v * 8 * 100) / 100),
            pingTests: pingTests.map((v) => Math.round(v)),
        };
    } catch {
        return { download: 0, upload: 0, ping: 999, passed: false, downloadTests: [], uploadTests: [], pingTests: [] };
    }
}
