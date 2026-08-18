// This gate decides whether a candidate may sit their interview, so every number
// has to be a real measurement. Where one is impossible it returns null, not a
// placeholder — turning someone away on an invented figure is worse than saying
// we don't know.

export interface InternetSpeedResult {
    /** Mbps, or null when the measurement could not be taken at all. */
    download: number | null;
    upload: number | null;
    /** Milliseconds, or null when unreachable. */
    ping: number | null;
    passed: boolean;
    /** True when at least one metric could not be measured — distinct from failing. */
    incomplete: boolean;
    downloadTests: number[];
    uploadTests: number[];
    pingTests: number[];
}

export interface SpeedThresholds {
    minDownloadMbps: number;
    minUploadMbps: number;
    maxPingMs: number;
}

// What the stream actually needs, from the app's own audio config:
//   upload   — useAudioCapture:  16 kHz mono Int16 = 0.256 Mbps
//   download — useAudioPlayback: 24 kHz      Int16 = 0.384 Mbps
//
// 2 Mbps is ~6× that. The headroom covers reconnects and whatever else shares
// the link — an interview that degrades halfway is still rated as the
// candidate's answer. Published guidance for audio-only assessment lands in the
// same range. These were 8/4, roughly 20×, turning away usable connections.
//
// Ping stays at 300 ms, not the 100 ms sometimes quoted: ITU-T G.114 calls
// under 150 ms one-way good for conversation, and the dominant wait here is
// Gemini replying. 100 ms would exclude Indonesian mobile for nothing audible.
export const DEFAULT_THRESHOLDS: SpeedThresholds = {
    minDownloadMbps: 2,
    minUploadMbps: 2,
    maxPingMs: 300,
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "");

// Our own API by default. These used to hit httpbin.org and postman-echo.com:
// the candidate's browser POSTed half a megabyte to an undisclosed third party,
// and what got measured was how busy that party was. Same connection, 1.03 Mbps
// against httpbin vs 62 Mbps locally.
const PING_URL =
    (import.meta.env.VITE_SPEED_TEST_PING_URL as string | undefined) ||
    (API_BASE ? `${API_BASE}/health` : undefined);

const UPLOAD_URL =
    (import.meta.env.VITE_SPEED_TEST_UPLOAD_URL as string | undefined) ||
    (API_BASE ? `${API_BASE}/speed_test` : undefined);

// Still public CDN assets — the API serves nothing big enough to time, and a GET
// of a public file leaks far less than POSTing to an echo service. Size comes
// from Content-Length, not a hardcoded guess.
const DOWNLOAD_TEST_URLS = [
    "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css",
    "https://unpkg.com/react@18/umd/react.development.js",
    "https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js",
];

const UPLOAD_SIZE_MB = 0.5;

async function measurePing(): Promise<number | null> {
    if (!PING_URL) return null;
    try {
        const start = performance.now();
        const response = await fetch(PING_URL, { cache: "no-cache" });
        if (!response.ok) return null;
        return performance.now() - start;
    } catch {
        return null;
    }
}

/** Returns MB/s, or null if nothing could be timed. */
async function measureDownloadSpeed(): Promise<number | null> {
    for (const url of DOWNLOAD_TEST_URLS) {
        try {
            const start = performance.now();
            const response = await fetch(url, { cache: "no-cache" });
            if (!response.ok) continue;

            const body = await response.blob();
            const bytes = Number(response.headers.get("content-length")) || body.size;
            if (!bytes) continue;

            const seconds = (performance.now() - start) / 1000;
            if (seconds <= 0) continue;

            return bytes / (1024 * 1024) / seconds;
        } catch {
            continue;
        }
    }
    return null;
}

/** Returns MB/s, or null if nothing could be timed. */
async function measureUploadSpeed(): Promise<number | null> {
    if (!UPLOAD_URL) return null;

    const payload = new Blob([new ArrayBuffer(UPLOAD_SIZE_MB * 1024 * 1024)], {
        type: "application/octet-stream",
    });

    try {
        const formData = new FormData();
        formData.append("test", payload);
        const start = performance.now();
        const response = await fetch(UPLOAD_URL, { method: "POST", body: formData });
        if (!response.ok) return null;

        const seconds = (performance.now() - start) / 1000;
        if (seconds <= 0) return null;

        return UPLOAD_SIZE_MB / seconds;
    } catch {
        return null;
    }
}

async function runMultipleTests(
    testFn: () => Promise<number | null>,
    count = 3
): Promise<number[]> {
    const results: number[] = [];
    for (let i = 0; i < count; i++) {
        const value = await testFn();
        if (value !== null) results.push(value);
        await new Promise((r) => setTimeout(r, 100));
    }
    return results;
}

/** Trimmed mean once there are enough samples; null when there are none. */
function average(values: number[]): number | null {
    if (values.length === 0) return null;
    if (values.length <= 2) return values.reduce((a, b) => a + b, 0) / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
    return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export async function testInternetSpeed(
    thresholds: SpeedThresholds = DEFAULT_THRESHOLDS
): Promise<InternetSpeedResult> {
    const [downloadTests, uploadTests, pingTests] = await Promise.all([
        runMultipleTests(measureDownloadSpeed),
        runMultipleTests(measureUploadSpeed),
        runMultipleTests(measurePing),
    ]);

    const downloadMbps = average(downloadTests);
    const uploadMbps = average(uploadTests);
    const ping = average(pingTests);

    const incomplete = downloadMbps === null || uploadMbps === null || ping === null;

    // Only a measured metric can fail. An unmeasured one marks the result
    // incomplete, which the UI reports as "couldn't measure".
    const passed =
        !incomplete &&
        downloadMbps! * 8 >= thresholds.minDownloadMbps &&
        uploadMbps! * 8 >= thresholds.minUploadMbps &&
        ping! <= thresholds.maxPingMs;

    return {
        download: downloadMbps === null ? null : round2(downloadMbps * 8),
        upload: uploadMbps === null ? null : round2(uploadMbps * 8),
        ping: ping === null ? null : Math.round(ping),
        passed,
        incomplete,
        downloadTests: downloadTests.map((v) => round2(v * 8)),
        uploadTests: uploadTests.map((v) => round2(v * 8)),
        pingTests: pingTests.map((v) => Math.round(v)),
    };
}

/** A metric that was never measured is neither pass nor fail — it is unknown. */
export function metOrUnknown(value: number | null, minimum: number): boolean {
    return value === null || value >= minimum;
}

/** Only the metrics that actually fell short, each with what was needed. */
export function shortfalls(
    result: InternetSpeedResult,
    thresholds: SpeedThresholds = DEFAULT_THRESHOLDS
): string[] {
    const lines: string[] = [];
    if (result.download !== null && result.download < thresholds.minDownloadMbps) {
        lines.push(`Download ${result.download} Mbps — needs ${thresholds.minDownloadMbps} Mbps`);
    }
    if (result.upload !== null && result.upload < thresholds.minUploadMbps) {
        lines.push(`Upload ${result.upload} Mbps — needs ${thresholds.minUploadMbps} Mbps`);
    }
    if (result.ping !== null && result.ping > thresholds.maxPingMs) {
        lines.push(`Latency ${result.ping} ms — needs ${thresholds.maxPingMs} ms or less`);
    }
    return lines;
}
