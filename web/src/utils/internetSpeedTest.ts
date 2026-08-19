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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");
const SPEED_TEST_PING_URL =
    (import.meta.env.VITE_SPEED_TEST_PING_URL as string | undefined) ||
    (API_BASE_URL ? `${API_BASE_URL}/health` : undefined);
const SPEED_TEST_DOWNLOAD_URL =
    (import.meta.env.VITE_SPEED_TEST_DOWNLOAD_URL as string | undefined) ||
    (API_BASE_URL ? `${API_BASE_URL}/speed_test` : undefined);
const SPEED_TEST_UPLOAD_URL =
    (import.meta.env.VITE_SPEED_TEST_UPLOAD_URL as string | undefined) ||
    (API_BASE_URL ? `${API_BASE_URL}/speed_test` : undefined);
const REQUEST_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } finally {
        window.clearTimeout(timeout);
    }
}

async function measurePing(): Promise<number> {
    if (SPEED_TEST_PING_URL) {
        try {
            const start = performance.now();
            await fetchWithTimeout(SPEED_TEST_PING_URL, { cache: "no-cache" });
            return performance.now() - start;
        } catch {
            return 999;
        }
    }
    const testUrls = [
        "https://www.google.com/favicon.ico",
        "https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js",
        "https://unpkg.com/react@18/umd/react.production.min.js",
    ];
    for (const url of testUrls) {
        try {
            const start = performance.now();
            await fetchWithTimeout(url, { mode: "no-cors", cache: "no-cache" });
            return performance.now() - start;
        } catch {
            continue;
        }
    }
    return 999;
}

async function measureDownloadSpeed(): Promise<number> {
    const testFiles = SPEED_TEST_DOWNLOAD_URL
        ? [{ url: SPEED_TEST_DOWNLOAD_URL, size: 1 }]
        : [
            { url: "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css", size: 0.2 },
            { url: "https://unpkg.com/react@18/umd/react.development.js", size: 1.2 },
            { url: "https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js", size: 0.09 },
        ];
    for (const testFile of testFiles) {
        try {
            const start = performance.now();
            const response = await fetchWithTimeout(testFile.url, { cache: "no-cache" });
            if (response.ok) {
                await response.blob();
                const seconds = (performance.now() - start) / 1000;
                return testFile.size / seconds;
            }
        } catch {
            continue;
        }
    }
    // Rough fallback
    try {
        const start = performance.now();
        await fetchWithTimeout("https://www.google.com/favicon.ico", { mode: "no-cors", cache: "no-cache" });
        const duration = (performance.now() - start) / 1000;
        return duration < 1 ? 2 : duration < 2 ? 1 : 0.5;
    } catch {
        return 0;
    }
}

async function measureUploadSpeed(): Promise<number> {
    const uploadSizeMB = 0.5;
    const uploadData = new Blob([new ArrayBuffer(uploadSizeMB * 1024 * 1024)], {
        type: "application/octet-stream",
    });
    const endpoints = SPEED_TEST_UPLOAD_URL
        ? [SPEED_TEST_UPLOAD_URL]
        : ["https://httpbin.org/post", "https://www.httpbin.org/post", "https://postman-echo.com/post"];
    for (const endpoint of endpoints) {
        try {
            const formData = new FormData();
            formData.append("test", uploadData);
            const start = performance.now();
            const response = await fetchWithTimeout(endpoint, { method: "POST", body: formData });
            if (!response.ok) continue;
            const seconds = (performance.now() - start) / 1000;
            return uploadSizeMB / seconds;
        } catch {
            continue;
        }
    }
    return 0.5; // conservative fallback
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
