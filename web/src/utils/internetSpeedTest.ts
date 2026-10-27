// Internet speed checks use the application's API so browsers can read exact test payloads.

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

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api/v1"
).replace(/\/+$/, "");
const SPEED_TEST_URL = `${API_BASE_URL}/speed_test`;
const SPEED_TEST_PING_URL =
  (import.meta.env.VITE_SPEED_TEST_PING_URL as string | undefined) ??
  `${SPEED_TEST_URL}?type=ping`;
const SPEED_TEST_UPLOAD_URL =
  (import.meta.env.VITE_SPEED_TEST_UPLOAD_URL as string | undefined) ??
  SPEED_TEST_URL;
const DOWNLOAD_TEST_URL = `${SPEED_TEST_URL}?type=download`;
const DOWNLOAD_SIZE_BYTES = 512 * 1024;
const UPLOAD_SIZE_BYTES = 512 * 1024;

async function measurePing(): Promise<number> {
  const start = performance.now();
  const response = await fetch(SPEED_TEST_PING_URL, { cache: "no-store" });
  if (!response.ok)
    throw new Error(`Ping test failed with status ${response.status}`);
  await response.arrayBuffer();
  return performance.now() - start;
}

async function measureDownloadSpeed(): Promise<number> {
  const start = performance.now();
  const response = await fetch(DOWNLOAD_TEST_URL, { cache: "no-store" });
  if (!response.ok)
    throw new Error(`Download test failed with status ${response.status}`);
  const bytesReceived = (await response.arrayBuffer()).byteLength;
  if (bytesReceived !== DOWNLOAD_SIZE_BYTES) {
    throw new Error("Download test returned an unexpected payload size");
  }
  const seconds = (performance.now() - start) / 1000;
  return (bytesReceived * 8) / 1_000_000 / seconds;
}

async function measureUploadSpeed(): Promise<number> {
  const payload = new ArrayBuffer(UPLOAD_SIZE_BYTES);
  const configuredUploadUrl = import.meta.env.VITE_SPEED_TEST_UPLOAD_URL as
    | string
    | undefined;
  let body: BodyInit = payload;
  if (configuredUploadUrl) {
    const formData = new FormData();
    formData.append(
      "test",
      new Blob([payload], { type: "application/octet-stream" }),
    );
    body = formData;
  }
  const start = performance.now();
  const response = await fetch(SPEED_TEST_UPLOAD_URL, {
    method: "POST",
    ...(configuredUploadUrl
      ? {}
      : { headers: { "Content-Type": "application/octet-stream" } }),
    body,
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(`Upload test failed with status ${response.status}`);

  if (!configuredUploadUrl) {
    const result: unknown = await response.json();
    if (
      typeof result !== "object" ||
      result === null ||
      !("received_bytes" in result) ||
      result.received_bytes !== UPLOAD_SIZE_BYTES
    ) {
      throw new Error("Upload test did not receive the expected payload size");
    }
  }

  const seconds = (performance.now() - start) / 1000;
  return (UPLOAD_SIZE_BYTES * 8) / 1_000_000 / seconds;
}

async function runMultipleTests<T>(
  testFn: () => Promise<T>,
  count = 3,
): Promise<T[]> {
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
  if (values.length <= 2)
    return values.reduce((a, b) => a + b, 0) / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1);
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

export async function testInternetSpeed(
  thresholds: SpeedThresholds = DEFAULT_THRESHOLDS,
): Promise<InternetSpeedResult> {
  try {
    const [downloadTests, uploadTests, pingTests] = await Promise.all([
      runMultipleTests(measureDownloadSpeed, 3),
      runMultipleTests(measureUploadSpeed, 3),
      runMultipleTests(measurePing, 3),
    ]);

    const downloadMbps = average(downloadTests);
    const uploadMbps = average(uploadTests);
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
      downloadTests: downloadTests.map((v) => Math.round(v * 100) / 100),
      uploadTests: uploadTests.map((v) => Math.round(v * 100) / 100),
      pingTests: pingTests.map((v) => Math.round(v)),
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
    };
  }
}
