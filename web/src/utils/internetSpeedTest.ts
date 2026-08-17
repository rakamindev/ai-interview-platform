// Internet Speed Test Utilities — probes the platform's own API so a healthy
// connection isn't rejected just because a third-party test service (CDN,
// httpbin, postman-echo) is slow, blocked, or CORS-restricted.

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

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

const SPEED_TEST_PING_URL =
  (import.meta.env.VITE_SPEED_TEST_PING_URL as string | undefined) || "";
const SPEED_TEST_DOWNLOAD_URL =
  (import.meta.env.VITE_SPEED_TEST_DOWNLOAD_URL as string | undefined) || "";
const SPEED_TEST_UPLOAD_URL =
  (import.meta.env.VITE_SPEED_TEST_UPLOAD_URL as string | undefined) || "";

const PING_URL = SPEED_TEST_PING_URL || `${API_BASE}/health`;
const DOWNLOAD_URL = SPEED_TEST_DOWNLOAD_URL || `${API_BASE}/speed_test`;
const UPLOAD_URL = SPEED_TEST_UPLOAD_URL || `${API_BASE}/speed_test`;

// Real payloads: the old 0.09–1.2 MB files mostly measured TTFB/latency, not
// bandwidth. Stream the full body and time only the transfer (after headers).
const UPLOAD_PAYLOAD_BYTES = 2 * 1024 * 1024;

function mbps(bytes: number, seconds: number): number {
  if (bytes <= 0 || seconds <= 0) return 0;
  return (bytes * 8) / seconds / 1_000_000;
}

async function measurePingMs(): Promise<number | null> {
  try {
    const start = performance.now();
    await fetch(PING_URL, { cache: "no-store" });
    return performance.now() - start;
  } catch {
    return null;
  }
}

async function measureDownloadMbps(): Promise<number | null> {
  try {
    const response = await fetch(DOWNLOAD_URL, { cache: "no-store" });
    if (!response.ok || !response.body) return null;

    const reader = response.body.getReader();
    let bytes = 0;
    let startedAt: number | null = null;
    let endedAt = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        endedAt = performance.now();
        break;
      }
      if (startedAt === null) startedAt = performance.now();
      bytes += value.byteLength;
    }

    const result = mbps(bytes, (endedAt - (startedAt ?? endedAt)) / 1000);
    return result > 0 ? result : null;
  } catch {
    return null;
  }
}

async function measureUploadMbps(): Promise<number | null> {
  try {
    const body = new Blob([new ArrayBuffer(UPLOAD_PAYLOAD_BYTES)], {
      type: "application/octet-stream",
    });
    const start = performance.now();
    const response = await fetch(UPLOAD_URL, {
      method: "POST",
      body,
      cache: "no-store",
    });
    if (!response.ok) return null;
    const result = mbps(
      UPLOAD_PAYLOAD_BYTES,
      (performance.now() - start) / 1000
    );
    return result > 0 ? result : null;
  } catch {
    return null;
  }
}

// Sequential — download, upload and ping share the same link, so running them
// with Promise.all made every measurement compete for bandwidth and undercount.
async function runSamples<T>(
  sample: () => Promise<T | null>,
  count: number
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < count; i++) {
    const value = await sample();
    if (value !== null) results.push(value);
    await new Promise((r) => setTimeout(r, 100));
  }
  return results;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  if (values.length <= 2) {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1);
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

export async function testInternetSpeed(
  thresholds: SpeedThresholds = DEFAULT_THRESHOLDS
): Promise<InternetSpeedResult> {
  const pingTests = await runSamples(measurePingMs, 3);
  const downloadTests = await runSamples(measureDownloadMbps, 2);
  const uploadTests = await runSamples(measureUploadMbps, 2);

  // A measurement that never succeeded must fail the check (ping default 999,
  // zero bandwidth otherwise) rather than masquerade as 0ms / healthy.
  const download = downloadTests.length ? average(downloadTests) : 0;
  const upload = uploadTests.length ? average(uploadTests) : 0;
  const ping = pingTests.length ? average(pingTests) : 999;

  const passed =
    download >= thresholds.minDownloadMbps &&
    upload >= thresholds.minUploadMbps &&
    ping <= thresholds.maxPingMs;

  return {
    download: Math.round(download * 100) / 100,
    upload: Math.round(upload * 100) / 100,
    ping: Math.round(ping),
    passed,
    downloadTests: downloadTests.map((v) => Math.round(v * 100) / 100),
    uploadTests: uploadTests.map((v) => Math.round(v * 100) / 100),
    pingTests: pingTests.map((v) => Math.round(v)),
  };
}
