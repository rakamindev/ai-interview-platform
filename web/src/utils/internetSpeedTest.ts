// Internet Speed Test Utilities — standalone, no backend dependency

export interface InternetSpeedResult {
    download: number;      // Mbps
    upload: number;        // Mbps
    ping: number;          // ms — round-trip to the API server
    passed: boolean;
    downloadTests: number[];
    uploadTests: number[];
    pingTests: number[];
    failReason?: string;   // human-readable explanation when passed=false
}

export interface SpeedThresholds {
    minDownloadMbps: number;
    minUploadMbps: number;
    maxPingMs: number;
}

export const DEFAULT_THRESHOLDS: SpeedThresholds = {
    minDownloadMbps: Number(import.meta.env.VITE_MIN_DOWNLOAD_MBPS) || 5,
    minUploadMbps: Number(import.meta.env.VITE_MIN_UPLOAD_MBPS) || 1, // lowered from 4
    maxPingMs: Number(import.meta.env.VITE_MAX_PING_MS) || 500,
};

// Ping the actual API server — the only latency that matters for this product.
// Falls back to public CDN endpoints if VITE_API_BASE_URL is not configured.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;
const SPEED_TEST_PING_URL = import.meta.env.VITE_SPEED_TEST_PING_URL as string | undefined;

async function measureApiLatency(): Promise<number> {
    // Prefer the configured API URL — this tests the actual server the interview uses.
    const pingTarget = SPEED_TEST_PING_URL
        || (API_BASE_URL ? `${API_BASE_URL.replace('/api/v1', '')}/` : null);

    if (pingTarget) {
        try {
            const start = performance.now();
            await fetch(pingTarget, { method: 'HEAD', cache: 'no-cache', mode: 'no-cors' });
            return performance.now() - start;
        } catch {
            return 999;
        }
    }

    // Public CDN fallback — only used when API URL is not configured (e.g. standalone demo)
    const fallbackUrls = [
        'https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js',
        'https://unpkg.com/react@18/umd/react.production.min.js',
    ];
    for (const url of fallbackUrls) {
        try {
            const start = performance.now();
            await fetch(url, { mode: 'no-cors', cache: 'no-cache' });
            return performance.now() - start;
        } catch {
            continue;
        }
    }
    return 999;
}

async function measureDownloadSpeed(): Promise<number> {
    const testFiles = [
        { url: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css', sizeMB: 0.2 },
        { url: 'https://unpkg.com/react@18/umd/react.development.js', sizeMB: 1.2 },
        { url: 'https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js', sizeMB: 0.09 },
    ];
    for (const { url, sizeMB } of testFiles) {
        try {
            const start = performance.now();
            const response = await fetch(url, { cache: 'no-cache' });
            if (response.ok) {
                await response.blob();
                const seconds = (performance.now() - start) / 1000;
                return sizeMB / seconds; // MB/s → multiply by 8 for Mbps
            }
        } catch {
            continue;
        }
    }
    // Rough fallback
    try {
        const start = performance.now();
        await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', cache: 'no-cache' });
        const duration = (performance.now() - start) / 1000;
        return duration < 1 ? 2 : duration < 2 ? 1 : 0.5;
    } catch {
        return 0;
    }
}

async function measureUploadSpeed(): Promise<number> {
    const uploadTarget = import.meta.env.VITE_SPEED_TEST_UPLOAD_URL as string | undefined;
    const targets = uploadTarget ? [uploadTarget] : ['https://httpbin.org/post', 'https://postman-echo.com/post'];
    const payloadSizeMB = 0.5; // 500 KB payload
    const payload = new Blob([new ArrayBuffer(payloadSizeMB * 1024 * 1024)]);

    for (const url of targets) {
        try {
            const start = performance.now();
            const response = await fetch(url, { method: 'POST', body: payload, cache: 'no-cache', mode: 'cors' });
            if (response.ok) {
                const seconds = (performance.now() - start) / 1000;
                return payloadSizeMB / seconds;
            }
        } catch {
            continue;
        }
    }
    return 0; // Return 0 if all attempts fail
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

function buildFailReason(downloadMbps: number, uploadMbps: number, ping: number, thresholds: SpeedThresholds): string | undefined {
    const reasons: string[] = [];
    if (downloadMbps < thresholds.minDownloadMbps) {
        reasons.push(`download speed too low (${downloadMbps.toFixed(1)} Mbps, need ≥ ${thresholds.minDownloadMbps} Mbps)`);
    }
    if (uploadMbps < thresholds.minUploadMbps) {
        reasons.push(`upload speed too low (${uploadMbps.toFixed(1)} Mbps, need ≥ ${thresholds.minUploadMbps} Mbps)`);
    }
    if (ping > thresholds.maxPingMs) {
        reasons.push(`latency too high (${Math.round(ping)} ms, need ≤ ${thresholds.maxPingMs} ms)`);
    }
    return reasons.length > 0 ? reasons.join(' · ') : undefined;
}

export async function testInternetSpeed(
    thresholds: SpeedThresholds = DEFAULT_THRESHOLDS
): Promise<InternetSpeedResult> {
    try {
        // Run download, upload, and ping tests in parallel for speed.
        const [downloadTests, uploadTests, pingTests] = await Promise.all([
            runMultipleTests(measureDownloadSpeed, 3),
            runMultipleTests(measureUploadSpeed, 3),
            runMultipleTests(measureApiLatency, 3),
        ]);

        const downloadMbps = average(downloadTests) * 8; // convert MB/s → Mbps
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
            failReason: passed ? undefined : buildFailReason(downloadMbps, uploadMbps, ping, thresholds),
        };
    } catch {
        return {
            download: 0,
            upload: 0,
            ping: 999,
            passed: false,
            downloadTests: [],
            uploadTests: [],
            pingTests: [],
            failReason: 'Connection test failed — could not reach test servers',
        };
    }
}
