// Pre-interview connection check. The interview is audio-only: the mic streams 16 kHz mono PCM
// (~0.26 Mbps up) and AI playback is 24 kHz PCM (~0.4 Mbps down), so thresholds are sized to that.
import { API_BASE_URL } from "@/services/api";

export type ConnectionQuality = "good" | "fair" | "poor" | "unknown";

export interface InternetSpeedResult {
    download: number | null; // Mbps, null when it couldn't be measured
    upload: number | null; // Mbps
    ping: number | null; // ms
    quality: ConnectionQuality;
}

export interface SpeedThresholds {
    minDownloadMbps: number;
    minUploadMbps: number;
    maxPingMs: number;
    recommendedDownloadMbps: number;
    recommendedUploadMbps: number;
    recommendedPingMs: number;
}

// Minimum ≈ 2x what the audio stream needs; recommended ≈ 4x, leaving room for other traffic on the network.
export const DEFAULT_THRESHOLDS: SpeedThresholds = {
    minDownloadMbps: 1,
    minUploadMbps: 0.5,
    maxPingMs: 1000,
    recommendedDownloadMbps: 2,
    recommendedUploadMbps: 1,
    recommendedPingMs: 300,
};

const PING_URL = (import.meta.env.VITE_SPEED_TEST_PING_URL as string | undefined) || `${API_BASE_URL}/health`;
const UPLOAD_URL = (import.meta.env.VITE_SPEED_TEST_UPLOAD_URL as string | undefined) || "https://speed.cloudflare.com/__up";
const DOWNLOAD_URL = "https://speed.cloudflare.com/__down";

const DOWNLOAD_BYTES = 500_000;
const UPLOAD_BYTES = 250_000;
const PING_TIMEOUT_MS = 3_000;
const TRANSFER_TIMEOUT_MS = 8_000;

type Sample = { ms: number; bytes: number } | "timeout" | null;

// Times the full request including the body, so a slow body read counts against the connection.
async function timedRequest(url: string, init: RequestInit, timeoutMs: number): Promise<Sample> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = performance.now();
    try {
        const res = await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
        if (!res.ok) return null;
        const bytes = (await res.arrayBuffer()).byteLength;
        return { ms: performance.now() - start, bytes };
    } catch {
        return controller.signal.aborted ? "timeout" : null;
    } finally {
        clearTimeout(timer);
    }
}

const toMbps = (bytes: number, ms: number) => (bytes * 8) / (ms / 1000) / 1_000_000;

async function measurePingMs(): Promise<number | null> {
    const samples: number[] = [];
    for (let i = 0; i < 3; i++) {
        const sample = await timedRequest(PING_URL, {}, PING_TIMEOUT_MS);
        if (sample === "timeout") {
            samples.push(PING_TIMEOUT_MS);
            break;
        }
        if (sample) samples.push(sample.ms);
    }
    // Min is the standard RTT estimate: the first request also pays for DNS and the TLS handshake.
    return samples.length ? Math.min(...samples) : null;
}

async function measureThroughputMbps(url: string, init: RequestInit, bytes: number): Promise<number | null> {
    let best: number | null = null;
    for (let i = 0; i < 2; i++) {
        const sample = await timedRequest(url, init, TRANSFER_TIMEOUT_MS);
        if (sample === "timeout") {
            // Didn't finish in time, so the speed is at most this; that's already below the minimum.
            best = Math.max(best ?? 0, toMbps(bytes, TRANSFER_TIMEOUT_MS));
            break;
        }
        if (sample) best = Math.max(best ?? 0, toMbps(bytes, sample.ms));
    }
    return best;
}

export function classifyConnection(
    { download, upload, ping }: Pick<InternetSpeedResult, "download" | "upload" | "ping">,
    t: SpeedThresholds = DEFAULT_THRESHOLDS
): ConnectionQuality {
    const tooSlow =
        (upload !== null && upload < t.minUploadMbps) ||
        (download !== null && download < t.minDownloadMbps) ||
        (ping !== null && ping > t.maxPingMs);
    if (tooSlow) return "poor";
    if (upload === null || download === null || ping === null) return "unknown";
    const belowRecommended =
        upload < t.recommendedUploadMbps || download < t.recommendedDownloadMbps || ping > t.recommendedPingMs;
    return belowRecommended ? "fair" : "good";
}

const round2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);

export async function testInternetSpeed(thresholds: SpeedThresholds = DEFAULT_THRESHOLDS): Promise<InternetSpeedResult> {
    if (!navigator.onLine) return { download: null, upload: null, ping: null, quality: "poor" };

    // Sequential on purpose: running these in parallel makes them compete for the same bandwidth.
    const ping = await measurePingMs();
    const download = await measureThroughputMbps(`${DOWNLOAD_URL}?bytes=${DOWNLOAD_BYTES}`, {}, DOWNLOAD_BYTES);
    const upload = await measureThroughputMbps(UPLOAD_URL, { method: "POST", body: new Blob([new Uint8Array(UPLOAD_BYTES)]) }, UPLOAD_BYTES);

    return {
        download: round2(download),
        upload: round2(upload),
        ping: ping === null ? null : Math.round(ping),
        quality: classifyConnection({ download, upload, ping }, thresholds),
    };
}
