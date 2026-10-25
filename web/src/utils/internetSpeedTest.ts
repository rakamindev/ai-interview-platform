// Internet Speed Test Utilities — standalone, no backend dependency

import { API_BASE_URL } from "@/config";

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
    minDownloadMbps: 2,
    minUploadMbps: 1,
    maxPingMs: 300,
};

// Voice interviews need far less than video: 16kHz PCM audio is ~0.25 Mbps
// each way. Thresholds above reflect real need with headroom.

async function fetchWithTimeout(url: string, timeoutMs = 10000, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

const SPEED_TEST_PING_URL = import.meta.env.VITE_SPEED_TEST_PING_URL as string | undefined;
const SPEED_TEST_UPLOAD_URL = import.meta.env.VITE_SPEED_TEST_UPLOAD_URL as string | undefined;

async function measurePing(): Promise<number> {
    if (SPEED_TEST_PING_URL) {
        try {
            const start = performance.now();
            await fetchWithTimeout(SPEED_TEST_PING_URL, 10000, { cache: "no-cache" });
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
            await fetchWithTimeout(url, 10000, { mode: "no-cors", cache: "no-cache" });
            return performance.now() - start;
        } catch {
            continue;
        }
    }
    return 999;
}

async function measureDownloadSpeed(): Promise<number> {
    const testFiles = [
        { url: "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css", size: 0.2 },
        { url: "https://unpkg.com/react@18/umd/react.development.js", size: 1.2 },
        { url: "https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js", size: 0.09 },
    ];
    for (const testFile of testFiles) {
        try {
            const start = performance.now();
            const response = await fetchWithTimeout(testFile.url, 10000, { cache: "no-cache" });
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
        await fetchWithTimeout("https://www.google.com/favicon.ico", 10000, { mode: "no-cors", cache: "no-cache" });
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
    // Self-hosted endpoint first, then fallback to external services
    const endpoints = SPEED_TEST_UPLOAD_URL
        ? [SPEED_TEST_UPLOAD_URL]
        : [`${API_BASE_URL}/speed_test`, "https://httpbin.org/post", "https://postman-echo.com/post"];
    for (const endpoint of endpoints) {
        try {
            const formData = new FormData();
            formData.append("test", uploadData);
            const start = performance.now();
            const response = await fetchWithTimeout(endpoint, 15000, { method: "POST", body: formData });
            // Skip non-OK responses (e.g., 503 from httpbin)
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
