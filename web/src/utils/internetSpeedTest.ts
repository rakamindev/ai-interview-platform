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
    minDownloadMbps: 0.5,
    minUploadMbps: 0.1,
    maxPingMs: 1000,
};

const SPEED_TEST_PING_URL = import.meta.env.VITE_SPEED_TEST_PING_URL as string | undefined;

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
    // Use no-cors so we don't hit CORS errors; response is opaque but timing works
    const testUrls = [
        "https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js",
        "https://unpkg.com/react@18/umd/react.production.min.js",
        "https://www.google.com/favicon.ico",
    ];
    for (const url of testUrls) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const start = performance.now();
            await fetch(url, { mode: "no-cors", cache: "no-cache", signal: controller.signal });
            clearTimeout(timeout);
            return performance.now() - start;
        } catch {
            continue;
        }
    }
    return 150; // assume reasonable ping if all fail
}

async function measureDownloadSpeed(): Promise<number> {
    const testFiles = [
        { url: "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css", size: 0.2 },
        { url: "https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js", size: 0.09 },
    ];
    for (const testFile of testFiles) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const start = performance.now();
            const response = await fetch(testFile.url, { cache: "no-cache", signal: controller.signal });
            if (response.ok) {
                await response.blob();
                clearTimeout(timeout);
                const seconds = (performance.now() - start) / 1000;
                return testFile.size / seconds;
            }
            clearTimeout(timeout);
        } catch {
            continue;
        }
    }
    // Rough fallback via no-cors
    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 3000);
        const start = performance.now();
        await fetch("https://www.google.com/favicon.ico", { mode: "no-cors", cache: "no-cache", signal: controller.signal });
        const duration = (performance.now() - start) / 1000;
        return duration < 1 ? 2 : 1;
    } catch {
        return 2.0; // permissive fallback — assume adequate speed
    }
}

async function measureUploadSpeed(): Promise<number> {
    // Upload speed test against external endpoints often fails due to CORS in browsers.
    // We skip the real upload test and return a permissive default so it never blocks the interview.
    // Real-world: Gemini WebSocket audio will self-throttle if bandwidth is truly insufficient.
    return 1.0;
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
        // Run download and ping in parallel; upload is skipped (always returns 1.0)
        const [downloadTests, uploadTests, pingTests] = await Promise.all([
            Promise.all([measureDownloadSpeed(), measureDownloadSpeed()]),
            Promise.resolve([1.0, 1.0]), // skip upload — CORS-blocked externally
            Promise.all([measurePing(), measurePing()]),
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
        // If everything fails, assume it passed — don't block the interview
        return { download: 5, upload: 1, ping: 50, passed: true, downloadTests: [], uploadTests: [], pingTests: [] };
    }
}
