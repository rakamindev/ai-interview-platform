// Internet Speed Test Utilities.
//
// Defaults to this platform's own backend (see api/config/routes.rb
// speed_test endpoints) instead of third-party CDNs. Third-party endpoints
// (httpbin.org, jsdelivr, unpkg) can be blocked by a corporate firewall or
// simply be down, in which case a candidate with genuinely fine internet
// used to get hard-blocked from starting the interview by a hardcoded
// fallback number pretending to be a real (bad) measurement. See
// assessment/gap-analysis.md P0-5. VITE_SPEED_TEST_*_URL still overrides
// these defaults if a different target is ever needed.

import { API_BASE_URL } from "@/services/api";

export interface InternetSpeedResult {
    download: number | null;
    upload: number | null;
    ping: number | null;
    /**
     * "passed"/"failed" mean the measurement itself succeeded — we know the
     * real speed, and it either meets or misses the threshold. "inconclusive"
     * means the measurement couldn't complete at all (e.g. our own backend is
     * unreachable) — we genuinely don't know, and must not treat that the
     * same as "measured and it's bad".
     */
    status: "passed" | "failed" | "inconclusive";
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

const PING_URL = (import.meta.env.VITE_SPEED_TEST_PING_URL as string | undefined) || `${API_BASE_URL}/health`;
const DOWNLOAD_URL =
    (import.meta.env.VITE_SPEED_TEST_DOWNLOAD_URL as string | undefined) || `${API_BASE_URL}/speed_test/download`;
const UPLOAD_URL = (import.meta.env.VITE_SPEED_TEST_UPLOAD_URL as string | undefined) || `${API_BASE_URL}/speed_test`;

const DOWNLOAD_PAYLOAD_MB = 500_000 / (1024 * 1024); // matches the fixed size the backend sends

/** null means "couldn't measure", never a guessed number standing in for a real one. */
async function measurePing(): Promise<number | null> {
    try {
        const start = performance.now();
        await fetch(PING_URL, { cache: "no-cache" });
        return performance.now() - start;
    } catch {
        return null;
    }
}

async function measureDownloadSpeed(): Promise<number | null> {
    try {
        const start = performance.now();
        const response = await fetch(DOWNLOAD_URL, { cache: "no-cache" });
        if (!response.ok) return null;
        await response.blob();
        const seconds = (performance.now() - start) / 1000;
        return DOWNLOAD_PAYLOAD_MB / seconds;
    } catch {
        return null;
    }
}

async function measureUploadSpeed(): Promise<number | null> {
    const uploadSizeMB = 0.5;
    const uploadData = new Blob([new ArrayBuffer(uploadSizeMB * 1024 * 1024)], {
        type: "application/octet-stream",
    });
    try {
        const start = performance.now();
        await fetch(UPLOAD_URL, { method: "POST", body: uploadData });
        const seconds = (performance.now() - start) / 1000;
        return uploadSizeMB / seconds;
    } catch {
        return null;
    }
}

async function runMultipleTests<T>(testFn: () => Promise<T | null>, count = 3): Promise<T[]> {
    const results: T[] = [];
    for (let i = 0; i < count; i++) {
        const value = await testFn();
        if (value !== null) results.push(value);
        await new Promise((r) => setTimeout(r, 100));
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
    const [downloadTests, uploadTests, pingTests] = await Promise.all([
        runMultipleTests(measureDownloadSpeed, 3),
        runMultipleTests(measureUploadSpeed, 3),
        runMultipleTests(measurePing, 3),
    ]);

    // Every single attempt at every metric failed — most likely our own
    // backend (or the candidate's network entirely) is unreachable, not that
    // their internet is measurably slow. Inconclusive, not failed.
    if (downloadTests.length === 0 && uploadTests.length === 0 && pingTests.length === 0) {
        return { download: null, upload: null, ping: null, status: "inconclusive", downloadTests: [], uploadTests: [], pingTests: [] };
    }

    const downloadMbps = downloadTests.length ? average(downloadTests) * 8 : null;
    const uploadMbps = uploadTests.length ? average(uploadTests) * 8 : null;
    const ping = pingTests.length ? average(pingTests) : null;

    const passed =
        downloadMbps !== null && uploadMbps !== null && ping !== null &&
        downloadMbps >= thresholds.minDownloadMbps &&
        uploadMbps >= thresholds.minUploadMbps &&
        ping <= thresholds.maxPingMs;

    // Partial data (some metrics measured, others didn't) is still not
    // trustworthy enough to fail a candidate on — only a full measurement
    // that came back below threshold counts as a real "failed".
    const complete = downloadMbps !== null && uploadMbps !== null && ping !== null;

    return {
        download: downloadMbps !== null ? Math.round(downloadMbps * 100) / 100 : null,
        upload: uploadMbps !== null ? Math.round(uploadMbps * 100) / 100 : null,
        ping: ping !== null ? Math.round(ping) : null,
        status: passed ? "passed" : complete ? "failed" : "inconclusive",
        downloadTests: downloadTests.map((v) => Math.round(v * 8 * 100) / 100),
        uploadTests: uploadTests.map((v) => Math.round(v * 8 * 100) / 100),
        pingTests: pingTests.map((v) => Math.round(v)),
    };
}
