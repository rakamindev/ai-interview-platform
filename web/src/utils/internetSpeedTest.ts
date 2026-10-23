// Internet speed pre-check, measured against the interview API itself.
//
// The live interview WebSocket terminates on the same host as the REST API, so
// that host is the only target whose numbers mean anything. Nothing here
// substitutes a default when a measurement fails: an unreachable server, a
// timeout, or a slow link all fail the check with a reason the candidate can act on.

import { API_BASE_URL } from "@/lib/config";

// A null metric was not measured (its probe timed out or never ran).
export interface InternetSpeedResult {
    download: number | null;
    upload: number | null;
    ping: number | null;
    passed: boolean;
    failures: string[];
    error: string | null;
    downloadTests: number[];
    uploadTests: number[];
    pingTests: number[];
}

export interface SpeedThresholds {
    minDownloadMbps: number;
    minUploadMbps: number;
    maxPingMs: number;
}

export interface SpeedTestDeps {
    fetch: typeof fetch;
    now: () => number;
    baseUrl: string;
    timeoutMs: number;
}

// Live audio is raw PCM, not a compressed codec: 16 kHz Int16 upstream is
// 256 kbps and 24 kHz Int16 downstream is 384 kbps. The minimums leave roughly
// 2x headroom over each so the stream survives ordinary jitter.
export const DEFAULT_THRESHOLDS: SpeedThresholds = {
    minDownloadMbps: 1.0,
    minUploadMbps: 0.5,
    maxPingMs: 600,
};

const DOWNLOAD_BYTES = 256 * 1024;
const UPLOAD_BYTES = 128 * 1024;
const PING_SAMPLES = 4; // the first one pays for TCP/TLS setup and is discarded
const THROUGHPUT_SAMPLES = 2;
const REQUEST_TIMEOUT_MS = 6000;

const UNREACHABLE_MESSAGE =
    "Server wawancara tidak bisa dihubungi. Periksa koneksi internet lalu uji ulang.";
const RATE_LIMITED_MESSAGE = "Terlalu banyak percobaan. Tunggu satu menit lalu uji ulang.";
const INCOMPLETE_MESSAGE = "Data uji dari server tidak lengkap. Coba uji ulang sebentar lagi.";

class SpeedTestAbort extends Error {}

interface Sample {
    timedOut: boolean;
    elapsedMs: number;
    bytes: number;
}

interface Metric {
    values: number[];
    timedOut: boolean;
}

export function formatNumber(value: number): string {
    return value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function toMbps(bytes: number, elapsedMs: number): number {
    return (bytes * 8) / (Math.max(elapsedMs, 1) / 1000) / 1_000_000;
}

function statusMessage(status: number): string {
    if (status === 429) return RATE_LIMITED_MESSAGE;
    return `Server wawancara merespons dengan status ${status}. Coba uji ulang sebentar lagi.`;
}

// One request with its own timeout. A timeout is a measurement (the link is too
// slow), not an error; anything else that goes wrong aborts the whole check.
async function timedRequest(deps: SpeedTestDeps, url: string, init: RequestInit = {}): Promise<Sample> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, deps.timeoutMs);

    const start = deps.now();
    try {
        const response = await deps.fetch(url, { ...init, cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new SpeedTestAbort(statusMessage(response.status));
        // The transfer is not finished until the body is read.
        const bytes = (await response.arrayBuffer()).byteLength;
        return { timedOut: false, elapsedMs: deps.now() - start, bytes };
    } catch (err) {
        if (timedOut) return { timedOut: true, elapsedMs: deps.timeoutMs, bytes: 0 };
        if (err instanceof SpeedTestAbort) throw err;
        throw new SpeedTestAbort(UNREACHABLE_MESSAGE);
    } finally {
        clearTimeout(timer);
    }
}

// Sequential on purpose: concurrent probes would split the candidate's
// bandwidth between them and under-report every number. Any timeout ends the
// metric, because a multi-second stall would also stall live audio.
async function sample(count: number, request: () => Promise<Sample>, toValue: (s: Sample) => number): Promise<Metric> {
    const values: number[] = [];
    for (let i = 0; i < count; i++) {
        const result = await request();
        if (result.timedOut) return { values, timedOut: true };
        values.push(toValue(result));
    }
    return { values, timedOut: false };
}

async function measurePing(deps: SpeedTestDeps): Promise<Metric> {
    const metric = await sample(PING_SAMPLES, () => timedRequest(deps, `${deps.baseUrl}/health`), (s) => s.elapsedMs);
    return { ...metric, values: metric.values.slice(1) };
}

// A short body (a proxy truncating it, or a server cap below DOWNLOAD_BYTES)
// would make a small transfer look fast, so it aborts the check instead.
function downloadMbps(s: Sample): number {
    if (s.bytes < DOWNLOAD_BYTES) throw new SpeedTestAbort(INCOMPLETE_MESSAGE);
    return toMbps(s.bytes, s.elapsedMs);
}

async function measureDownload(deps: SpeedTestDeps): Promise<Metric> {
    const url = `${deps.baseUrl}/speed_test?bytes=${DOWNLOAD_BYTES}`;
    return sample(THROUGHPUT_SAMPLES, () => timedRequest(deps, url), downloadMbps);
}

async function measureUpload(deps: SpeedTestDeps): Promise<Metric> {
    // text/plain keeps this a CORS "simple" request, so no preflight round trip
    // lands inside the timer. The server only counts the bytes.
    const init: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: new Uint8Array(UPLOAD_BYTES),
    };
    const url = `${deps.baseUrl}/speed_test`;
    return sample(THROUGHPUT_SAMPLES, () => timedRequest(deps, url, init), (s) => toMbps(UPLOAD_BYTES, s.elapsedMs));
}

interface Measured {
    download: number | null;
    upload: number | null;
    ping: number | null;
}

// Best throughput sample, so one slow transfer does not block a candidate;
// median latency. A timed-out metric is null and fails on its own.
function summarize(ping: Metric, download: Metric, upload: Metric): Measured {
    const best = (m: Metric) => (m.timedOut ? null : round2(Math.max(...m.values)));
    return {
        download: best(download),
        upload: best(upload),
        ping: ping.timedOut ? null : Math.round(median(ping.values)),
    };
}

function collectFailures(measured: Measured, thresholds: SpeedThresholds, timeoutMs: number): string[] {
    const seconds = formatNumber(timeoutMs / 1000);
    const failures: string[] = [];

    if (measured.download === null) failures.push(`Unduh tidak selesai dalam ${seconds} detik`);
    else if (measured.download < thresholds.minDownloadMbps)
        failures.push(`Unduh ${formatNumber(measured.download)} Mbps, minimal ${formatNumber(thresholds.minDownloadMbps)} Mbps`);

    if (measured.upload === null) failures.push(`Unggah tidak selesai dalam ${seconds} detik`);
    else if (measured.upload < thresholds.minUploadMbps)
        failures.push(`Unggah ${formatNumber(measured.upload)} Mbps, minimal ${formatNumber(thresholds.minUploadMbps)} Mbps`);

    if (measured.ping === null) failures.push(`Latensi tidak terukur: server tidak membalas dalam ${seconds} detik`);
    else if (measured.ping > thresholds.maxPingMs)
        failures.push(`Latensi ${formatNumber(measured.ping)} ms, maksimal ${formatNumber(thresholds.maxPingMs)} ms`);

    return failures;
}

function unreachableResult(error: string): InternetSpeedResult {
    return {
        download: null,
        upload: null,
        ping: null,
        passed: false,
        failures: [],
        error,
        downloadTests: [],
        uploadTests: [],
        pingTests: [],
    };
}

export async function testInternetSpeed(
    thresholds: SpeedThresholds = DEFAULT_THRESHOLDS,
    overrides: Partial<SpeedTestDeps> = {}
): Promise<InternetSpeedResult> {
    const deps: SpeedTestDeps = {
        fetch: (...args) => fetch(...args),
        now: () => performance.now(),
        baseUrl: API_BASE_URL,
        timeoutMs: REQUEST_TIMEOUT_MS,
        ...overrides,
    };

    try {
        const ping = await measurePing(deps);
        const download = await measureDownload(deps);
        const upload = await measureUpload(deps);

        const measured = summarize(ping, download, upload);
        const failures = collectFailures(measured, thresholds, deps.timeoutMs);

        return {
            ...measured,
            passed: failures.length === 0,
            failures,
            error: null,
            downloadTests: download.values.map(round2),
            uploadTests: upload.values.map(round2),
            pingTests: ping.values.map(Math.round),
        };
    } catch (err) {
        return unreachableResult(err instanceof SpeedTestAbort ? err.message : UNREACHABLE_MESSAGE);
    }
}
