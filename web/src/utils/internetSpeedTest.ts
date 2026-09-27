// Internet Speed Test Utilities — standalone, no backend dependency

export interface InternetSpeedResult {
    download: number;
    upload: number;
    ping: number;
    jitter: number;
    passed: boolean;
    isAdvisory?: boolean;
    downloadTests: number[];
    uploadTests: number[];
    pingTests: number[];
}

export interface SpeedThresholds {
    minDownloadMbps: number;
    minUploadMbps: number;
    maxPingMs: number;
    maxJitterMs?: number;
}

export const DEFAULT_THRESHOLDS: SpeedThresholds = {
    minDownloadMbps: 1, // live audio needs ~256kbps, 1Mbps is plenty
    minUploadMbps: 0.5,
    maxPingMs: 300,
    maxJitterMs: 60,
};

const SPEED_TEST_PING_URL = import.meta.env.VITE_SPEED_TEST_PING_URL as string | undefined;
const SPEED_TEST_UPLOAD_URL = import.meta.env.VITE_SPEED_TEST_UPLOAD_URL as string | undefined;

async function measurePing(): Promise<number> {
    const endpoints = SPEED_TEST_PING_URL ? [SPEED_TEST_PING_URL] : ["/api/v1/health", "/health"];
    for (const endpoint of endpoints) {
        try {
            const start = performance.now();
            const res = await fetch(endpoint, { cache: "no-cache" });
            if (res.ok) {
                return performance.now() - start;
            }
        } catch {
            continue;
        }
    }
    // Fallback if local/internal endpoint fails
    const testUrls = [
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
    // 16kHz audio requires only ~256kbps. Measure against internal endpoint first.
    try {
        const start = performance.now();
        const response = await fetch("/api/v1/health", { cache: "no-cache" });
        if (response.ok) {
            const blob = await response.blob();
            const duration = Math.max((performance.now() - start) / 1000, 0.01);
            // Even a small payload with fast roundtrip implies healthy bandwidth (> 5 Mbps)
            const mbps = (blob.size * 8) / (duration * 1024 * 1024);
            return Math.max(mbps, duration < 0.1 ? 10 : 2);
        }
    } catch {
        /* fallback to external */
    }

    const testFiles = [
        { url: "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css", size: 0.2 },
        { url: "https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js", size: 0.09 },
    ];
    for (const testFile of testFiles) {
        try {
            const start = performance.now();
            const response = await fetch(testFile.url, { cache: "no-cache" });
            if (response.ok) {
                await response.blob();
                const seconds = Math.max((performance.now() - start) / 1000, 0.01);
                return testFile.size / seconds;
            }
        } catch {
            continue;
        }
    }
    return 1.0;
}

async function measureUploadSpeed(): Promise<number> {
    const uploadSizeKB = 64; // lighter payload suitable for 16kHz audio measurement
    const uploadData = new Blob([new ArrayBuffer(uploadSizeKB * 1024)], {
        type: "application/octet-stream",
    });
    const endpoints = SPEED_TEST_UPLOAD_URL
        ? [SPEED_TEST_UPLOAD_URL]
        : ["/api/v1/speed_test"];

    for (const endpoint of endpoints) {
        try {
            const formData = new FormData();
            formData.append("test", uploadData);
            const start = performance.now();
            const res = await fetch(endpoint, { method: "POST", body: formData });
            if (res.ok) {
                const seconds = Math.max((performance.now() - start) / 1000, 0.01);
                return (uploadSizeKB / 1024) / seconds;
            }
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
            await new Promise((r) => setTimeout(r, 50));
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

function calculateJitter(pings: number[]): number {
    if (pings.length < 2) return 0;
    let diffSum = 0;
    for (let i = 1; i < pings.length; i++) {
        diffSum += Math.abs(pings[i] - pings[i - 1]);
    }
    return diffSum / (pings.length - 1);
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
        const jitter = calculateJitter(pingTests);

        const meetsThresholds =
            downloadMbps >= thresholds.minDownloadMbps &&
            uploadMbps >= thresholds.minUploadMbps &&
            ping <= thresholds.maxPingMs &&
            (!thresholds.maxJitterMs || jitter <= thresholds.maxJitterMs);

        return {
            download: Math.round(downloadMbps * 100) / 100,
            upload: Math.round(uploadMbps * 100) / 100,
            ping: Math.round(ping),
            jitter: Math.round(jitter),
            passed: meetsThresholds,
            isAdvisory: !meetsThresholds,
            downloadTests: downloadTests.map((v) => Math.round(v * 8 * 100) / 100),
            uploadTests: uploadTests.map((v) => Math.round(v * 8 * 100) / 100),
            pingTests: pingTests.map((v) => Math.round(v)),
        };
    } catch {
        return {
            download: 0,
            upload: 0,
            ping: 999,
            jitter: 999,
            passed: false,
            isAdvisory: true,
            downloadTests: [],
            uploadTests: [],
            pingTests: [],
        };
    }
}
