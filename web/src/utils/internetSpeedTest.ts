// Measures the path that the interview actually uses: browser -> application API.

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
    // PCM interview audio needs far less bandwidth than video. These limits catch
    // unusable links without rejecting a stable mobile connection.
    minDownloadMbps: 0.25,
    minUploadMbps: 0.1,
    maxPingMs: 1500,
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api/v1").replace(/\/$/, "");
const SPEED_TEST_PING_URL = (import.meta.env.VITE_SPEED_TEST_PING_URL as string | undefined) || `${API_BASE_URL}/health`;
const SPEED_TEST_DOWNLOAD_URL = `${API_BASE_URL}/speed_test?bytes=262144`;
const SPEED_TEST_UPLOAD_URL = (import.meta.env.VITE_SPEED_TEST_UPLOAD_URL as string | undefined) || `${API_BASE_URL}/speed_test`;
const TEST_SIZE_MB = 0.25;

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
        const separator = url.includes("?") ? "&" : "?";
        return await fetch(`${url}${separator}_=${Date.now()}`, {
            ...init,
            cache: "no-store",
            signal: controller.signal,
        });
    } finally {
        window.clearTimeout(timeout);
    }
}

async function measurePing(): Promise<number> {
    try {
        const start = performance.now();
        const response = await fetchWithTimeout(SPEED_TEST_PING_URL);
        if (!response.ok) throw new Error(`Ping returned ${response.status}`);
        return performance.now() - start;
    } catch {
        return 999;
    }
}

async function measureDownloadSpeed(): Promise<number> {
    try {
        const start = performance.now();
        const response = await fetchWithTimeout(SPEED_TEST_DOWNLOAD_URL);
        if (!response.ok) throw new Error(`Download returned ${response.status}`);
        const body = await response.blob();
        const seconds = Math.max((performance.now() - start) / 1000, 0.001);
        return body.size / (1024 * 1024) / seconds;
    } catch {
        return 0;
    }
}

async function measureUploadSpeed(): Promise<number> {
    const uploadData = new Blob([new ArrayBuffer(TEST_SIZE_MB * 1024 * 1024)], {
        type: "application/octet-stream",
    });
    try {
        const start = performance.now();
        const response = await fetchWithTimeout(SPEED_TEST_UPLOAD_URL, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: uploadData,
        });
        if (!response.ok) throw new Error(`Upload returned ${response.status}`);
        const seconds = Math.max((performance.now() - start) / 1000, 0.001);
        return TEST_SIZE_MB / seconds;
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
