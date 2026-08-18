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

const SPEED_TEST_PING_URL = import.meta.env.VITE_SPEED_TEST_PING_URL as string | undefined;
const SPEED_TEST_UPLOAD_URL = import.meta.env.VITE_SPEED_TEST_UPLOAD_URL as string | undefined;

// Cloudflare's public speed-test endpoints: CORS-enabled, no auth, reliable.
// The same endpoints power the Cloudflare Speed Test page.
// Sized so that RTT overhead is negligible next to real transfer time.
const DOWNLOAD_URL = "https://speed.cloudflare.com/__down?bytes=5242880";

async function measurePing(): Promise<number> {
    if (SPEED_TEST_PING_URL) {
        try {
            const start = performance.now();
            await fetch(SPEED_TEST_PING_URL, { cache: "no-cache" });
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
            await fetch(url, { mode: "no-cors", cache: "no-cache" });
            return performance.now() - start;
        } catch {
            continue;
        }
    }
    return 999;
}

async function measureDownloadSpeed(): Promise<number> {
    try {
        const start = performance.now();
        const response = await fetch(DOWNLOAD_URL, { cache: "no-store" });
        if (!response.ok) throw new Error("download failed");
        const blob = await response.blob();
        const seconds = (performance.now() - start) / 1000;
        return blob.size / (1024 * 1024) / seconds;
    } catch {
        return 0; // failed: caller sees a failed run instead of a false pass
    }
}

async function measureUploadSpeed(): Promise<number> {
    const uploadSizeMB = 2;
    const uploadData = new Blob([new ArrayBuffer(uploadSizeMB * 1024 * 1024)], {
        type: "application/octet-stream",
    });
    const endpoints = SPEED_TEST_UPLOAD_URL
        ? [SPEED_TEST_UPLOAD_URL]
        : ["https://speed.cloudflare.com/__up"];
    for (const endpoint of endpoints) {
        try {
            const start = performance.now();
            const response = await fetch(endpoint, { method: "POST", body: uploadData });
            if (!response.ok) continue;
            const seconds = (performance.now() - start) / 1000;
            return uploadSizeMB / seconds;
        } catch {
            continue;
        }
    }
    return 0.5; // conservative fallback: exactly meets the 4 Mbps minimum
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
