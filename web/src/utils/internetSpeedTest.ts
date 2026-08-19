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

// Measure against the app's own API by default (the server the interview actually
// uses) — reliable and meaningful. Third-party hosts (httpbin, CDNs) were flaky and
// caused false failures. Explicit VITE_SPEED_TEST_* env vars still override.
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ??
    "http://localhost:3001/api/v1";

const PING_URL = (import.meta.env.VITE_SPEED_TEST_PING_URL as string | undefined) ?? `${API_BASE}/health`;
const DOWNLOAD_URL = (import.meta.env.VITE_SPEED_TEST_DOWNLOAD_URL as string | undefined) ?? `${API_BASE}/speed_test?bytes=1048576`;
const DOWNLOAD_SIZE_MB = 1;
const UPLOAD_URL = (import.meta.env.VITE_SPEED_TEST_UPLOAD_URL as string | undefined) ?? `${API_BASE}/speed_test`;

const FETCH_TIMEOUT_MS = 8000;

export async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function measurePing(): Promise<number> {
    try {
        const start = performance.now();
        await fetchWithTimeout(PING_URL, { cache: "no-store" });
        return performance.now() - start;
    } catch {
        return 999;
    }
}

async function measureDownloadSpeed(): Promise<number> {
    try {
        const start = performance.now();
        const response = await fetchWithTimeout(DOWNLOAD_URL, { cache: "no-store" });
        if (!response.ok) return 0;
        await response.blob();
        const seconds = Math.max((performance.now() - start) / 1000, 0.001);
        return DOWNLOAD_SIZE_MB / seconds;
    } catch {
        return 0;
    }
}

async function measureUploadSpeed(): Promise<number> {
    const uploadSizeMB = 0.5;
    const uploadData = new Blob([new ArrayBuffer(uploadSizeMB * 1024 * 1024)], {
        type: "application/octet-stream",
    });
    try {
        const start = performance.now();
        await fetchWithTimeout(UPLOAD_URL, { method: "POST", body: uploadData });
        const seconds = Math.max((performance.now() - start) / 1000, 0.001);
        return uploadSizeMB / seconds;
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
