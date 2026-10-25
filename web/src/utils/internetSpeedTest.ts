// Internet Speed Test Utilities — self-hosted only (UU PDP: zero third-party traffic by default)
//
// All speed-test traffic goes to the platform's own backend (derived from VITE_API_BASE_URL),
// never to external services. The VITE_SPEED_TEST_* overrides exist solely to point at internal
// infrastructure (e.g. a CDN in front of your own endpoints).

export interface InternetSpeedResult {
    download: number;
    upload: number;
    ping: number;
    passed: boolean;
    /** True when the speed test could not produce a complete measurement (any own endpoint failed at network level). The UI warns and lets the candidate continue. */
    unavailable: boolean;
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

// 1 MB payload served by GET /api/v1/speed_test?bytes=... for download measurement.
const DOWNLOAD_PAYLOAD_BYTES = 1024 * 1024;

interface Endpoints {
    ping: string;
    download: string;
    upload: string;
}

// Resolved at call time so env overrides can be tested and take effect without a module reload.
function resolveEndpoints(): Endpoints {
    const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? "http://localhost:3000/api/v1";
    return {
        ping: (import.meta.env.VITE_SPEED_TEST_PING_URL as string | undefined)?.trim() || `${apiBase}/health`,
        download:
            (import.meta.env.VITE_SPEED_TEST_DOWNLOAD_URL as string | undefined)?.trim() ||
            `${apiBase}/speed_test?bytes=${DOWNLOAD_PAYLOAD_BYTES}`,
        upload: (import.meta.env.VITE_SPEED_TEST_UPLOAD_URL as string | undefined)?.trim() || `${apiBase}/speed_test`,
    };
}

interface Measurement {
    value: number;
    ok: boolean;
}

async function measurePing(url: string): Promise<Measurement> {
    try {
        const start = performance.now();
        await fetch(url, { cache: "no-cache" });
        return { value: performance.now() - start, ok: true };
    } catch {
        return { value: 999, ok: false };
    }
}

async function measureDownloadSpeed(url: string): Promise<Measurement> {
    try {
        const start = performance.now();
        const response = await fetch(url, { cache: "no-cache" });
        if (!response.ok) return { value: 0, ok: false };
        const blob = await response.blob();
        const seconds = (performance.now() - start) / 1000;
        if (seconds <= 0 || blob.size === 0) return { value: 0, ok: false };
        const sizeMB = blob.size / (1024 * 1024);
        return { value: sizeMB / seconds, ok: true };
    } catch {
        return { value: 0, ok: false };
    }
}

async function measureUploadSpeed(url: string): Promise<Measurement> {
    const uploadSizeMB = 0.5;
    const uploadData = new Blob([new ArrayBuffer(uploadSizeMB * 1024 * 1024)], {
        type: "application/octet-stream",
    });
    try {
        const formData = new FormData();
        formData.append("test", uploadData);
        const start = performance.now();
        await fetch(url, { method: "POST", body: formData });
        const seconds = (performance.now() - start) / 1000;
        if (seconds <= 0) return { value: 0, ok: false };
        return { value: uploadSizeMB / seconds, ok: true };
    } catch {
        return { value: 0, ok: false };
    }
}

async function runMultipleTests(testFn: () => Promise<Measurement>, count = 3): Promise<Measurement[]> {
    const results: Measurement[] = [];
    for (let i = 0; i < count; i++) {
        results.push(await testFn());
        await new Promise((r) => setTimeout(r, 100));
    }
    return results;
}

function averageMeasurements(items: Measurement[]): Measurement {
    const values = items.filter((m) => m.ok).map((m) => m.value);
    if (values.length === 0) return { value: 0, ok: false };
    if (values.length === 1) return { value: values[0], ok: true };
    if (values.length === 2) return { value: (values[0] + values[1]) / 2, ok: true };
    const sorted = [...values].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
    return { value: trimmed.reduce((a, b) => a + b, 0) / trimmed.length, ok: true };
}

export async function testInternetSpeed(
    thresholds: SpeedThresholds = DEFAULT_THRESHOLDS
): Promise<InternetSpeedResult> {
    try {
        const { ping: pingUrl, download: downloadUrl, upload: uploadUrl } = resolveEndpoints();

        const [downloadTests, uploadTests, pingTests] = await Promise.all([
            runMultipleTests(() => measureDownloadSpeed(downloadUrl), 3),
            runMultipleTests(() => measureUploadSpeed(uploadUrl), 3),
            runMultipleTests(() => measurePing(pingUrl), 3),
        ]);

        const download = averageMeasurements(downloadTests);
        const upload = averageMeasurements(uploadTests);
        const ping = averageMeasurements(pingTests);

        // The test could not produce a complete measurement: at least one own endpoint failed at
        // the network level (e.g. speed_test down while health still responds). A partial result
        // is not a reliable basis to block the candidate — the UI warns and lets them continue.
        const unavailable = !download.ok || !upload.ok || !ping.ok;

        const downloadMbps = download.value * 8;
        const uploadMbps = upload.value * 8;

        const passed =
            download.ok &&
            downloadMbps >= thresholds.minDownloadMbps &&
            upload.ok &&
            uploadMbps >= thresholds.minUploadMbps &&
            ping.ok &&
            ping.value <= thresholds.maxPingMs;

        return {
            download: Math.round(downloadMbps * 100) / 100,
            upload: Math.round(uploadMbps * 100) / 100,
            ping: Math.round(ping.value),
            passed,
            unavailable,
            downloadTests: downloadTests.map((m) => Math.round(m.value * 8 * 100) / 100),
            uploadTests: uploadTests.map((m) => Math.round(m.value * 8 * 100) / 100),
            pingTests: pingTests.map((m) => Math.round(m.value)),
        };
    } catch {
        return {
            download: 0,
            upload: 0,
            ping: 999,
            passed: false,
            unavailable: true,
            downloadTests: [],
            uploadTests: [],
            pingTests: [],
        };
    }
}
