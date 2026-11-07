/**
 * Candidate readiness: measure the connection against our own API and turn the
 * numbers into pass / warn / fail based on what the interview audio needs.
 *
 * Replaces utils/internetSpeedTest.ts, which
 *  (a) had no timeouts, so one slow request could hang the check for minutes;
 *  (b) required ↑4 / ↓8 Mbps, more than 10x what the audio needs;
 *  (c) ran its probes concurrently, so they competed for the same link;
 *  (d) sent candidate traffic to third parties (httpbin, postman-echo, public CDNs);
 *  (e) turned a failed upload test into exactly the pass threshold.
 */

export type Verdict = "pass" | "warn" | "fail";

/** `null` means "could not be measured", never zero. */
export interface NetworkSample {
    downloadMbps: number | null;
    uploadMbps: number | null;
    latencyMs: number | null;
}

export interface NetworkAssessment {
    verdict: Verdict;
    /** Candidate-facing explanations, worst first. Empty when everything passed. */
    reasons: string[];
    /** False when at least one probe could not finish. */
    measured: boolean;
}

const PCM16_BITS = 16;

/** Raw bitrate of the interview audio streams (see useAudioCapture / useAudioPlayback). */
export const AUDIO_NEEDS = {
    uploadMbps: (16_000 * PCM16_BITS) / 1_000_000, // microphone: 16 kHz mono PCM16
    downloadMbps: (24_000 * PCM16_BITS) / 1_000_000, // AI voice: 24 kHz mono PCM16
} as const;

export const THRESHOLDS = {
    /** Below these the audio cannot keep up: block, with guidance. */
    fail: { uploadMbps: 0.3, downloadMbps: 0.5, latencyMs: 1_500 },
    /** Below these it should work but may stutter: allow, with a warning. */
    warn: { uploadMbps: 1, downloadMbps: 1.5, latencyMs: 400 },
} as const;

const fmt = (n: number) => (n < 10 ? n.toFixed(2) : n.toFixed(1));

export function assessNetwork({ downloadMbps: down, uploadMbps: up, latencyMs: rtt }: NetworkSample): NetworkAssessment {
    if (down === null && up === null && rtt === null) {
        return {
            verdict: "fail",
            measured: false,
            reasons: ["We couldn't reach the interview server. Check that you're online, then try again."],
        };
    }

    const failures: string[] = [];
    const warnings: string[] = [];

    if (up !== null) {
        if (up < THRESHOLDS.fail.uploadMbps) failures.push(`Upload speed (${fmt(up)} Mbps) is too low to send your voice.`);
        else if (up < THRESHOLDS.warn.uploadMbps) warnings.push(`Upload speed is low (${fmt(up)} Mbps), so your voice may break up.`);
    }
    if (down !== null) {
        if (down < THRESHOLDS.fail.downloadMbps) failures.push(`Download speed (${fmt(down)} Mbps) is too low to hear the interviewer.`);
        else if (down < THRESHOLDS.warn.downloadMbps) warnings.push(`Download speed is low (${fmt(down)} Mbps), so the interviewer may break up.`);
    }
    if (rtt !== null) {
        if (rtt > THRESHOLDS.fail.latencyMs) failures.push(`Your connection is too slow to respond (${Math.round(rtt)} ms).`);
        else if (rtt > THRESHOLDS.warn.latencyMs) warnings.push(`Your connection is a little slow to respond (${Math.round(rtt)} ms).`);
    }

    const measured = down !== null && up !== null && rtt !== null;
    if (!measured) warnings.push("Part of the connection test didn't finish, so we couldn't fully confirm it.");

    if (failures.length > 0) return { verdict: "fail", measured, reasons: failures };
    if (warnings.length > 0) return { verdict: "warn", measured, reasons: warnings };
    return { verdict: "pass", measured, reasons: [] };
}

export const DEFAULT_TIMEOUTS = { pingMs: 3_000, downloadMs: 10_000, uploadMs: 12_000 };
export const UPLOAD_BYTES = 256 * 1024;
const PING_SAMPLES = 3;

export interface MeasureOptions {
    /** API base, e.g. http://localhost:3001/api/v1. All probes stay on this origin. */
    baseUrl: string;
    fetchImpl?: typeof fetch;
    now?: () => number;
    timeouts?: Partial<typeof DEFAULT_TIMEOUTS>;
}

class ProbeTimeout extends Error {}

/** Rejects after `ms` even if the request ignores the abort signal. */
async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            reject(new ProbeTimeout(`probe timed out after ${ms} ms`));
        }, ms);
    });
    try {
        return await Promise.race([run(controller.signal), timeout]);
    } finally {
        clearTimeout(timer);
    }
}

const toMbps = (bytes: number, elapsedMs: number) => (bytes * 8) / (Math.max(elapsedMs, 1) / 1000) / 1_000_000;

/**
 * Measures latency, then download, then upload, one at a time: concurrent
 * probes compete for the same link and skew each other. Each probe has its own
 * timeout; a probe that fails or times out is reported as `null`.
 */
export async function measureNetwork({ baseUrl, fetchImpl, now, timeouts }: MeasureOptions): Promise<NetworkSample> {
    const doFetch = fetchImpl ?? globalThis.fetch.bind(globalThis);
    const clock = now ?? (() => performance.now());
    const t = { ...DEFAULT_TIMEOUTS, ...timeouts };
    const base = baseUrl.replace(/\/+$/, "");

    const latencyMs = await measureLatency();
    const downloadMbps = await measureDownload();
    const uploadMbps = await measureUpload();
    return { downloadMbps, uploadMbps, latencyMs };

    async function measureLatency(): Promise<number | null> {
        const samples: number[] = [];
        for (let i = 0; i < PING_SAMPLES; i++) {
            try {
                const start = clock();
                const res = await withTimeout(t.pingMs, (signal) =>
                    doFetch(`${base}/connectivity/ping`, { cache: "no-store", signal }),
                );
                if (!res.ok) break;
                samples.push(clock() - start);
            } catch {
                break; // a timed-out ping means the link is bad; don't spend more time
            }
        }
        if (samples.length === 0) return null;
        const sorted = [...samples].sort((a, b) => a - b);
        return Math.round(sorted[Math.floor(sorted.length / 2)]);
    }

    async function measureDownload(): Promise<number | null> {
        try {
            const start = clock();
            const bytes = await withTimeout(t.downloadMs, async (signal) => {
                const res = await doFetch(`${base}/connectivity/download`, { cache: "no-store", signal });
                if (!res.ok) throw new Error(`download probe failed: ${res.status}`);
                return (await res.arrayBuffer()).byteLength;
            });
            return toMbps(bytes, clock() - start);
        } catch {
            return null;
        }
    }

    async function measureUpload(): Promise<number | null> {
        try {
            const body = new Blob([new Uint8Array(UPLOAD_BYTES)], { type: "application/octet-stream" });
            const start = clock();
            const received = await withTimeout(t.uploadMs, async (signal) => {
                const res = await doFetch(`${base}/connectivity/upload`, {
                    method: "POST",
                    body,
                    cache: "no-store",
                    headers: { "Content-Type": "application/octet-stream" },
                    signal,
                });
                if (!res.ok) throw new Error(`upload probe failed: ${res.status}`);
                const json = (await res.json()) as { received_bytes?: unknown };
                if (typeof json.received_bytes !== "number") throw new Error("upload probe returned no byte count");
                return json.received_bytes;
            });
            return toMbps(received, clock() - start);
        } catch {
            return null;
        }
    }
}
