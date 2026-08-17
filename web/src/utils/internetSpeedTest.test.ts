import { describe, it, expect, vi, afterEach } from "vitest";
import { testInternetSpeed } from "@/utils/internetSpeedTest";

const MB = 1024 * 1024;

function timedDownloadResponse(
  bytes: number,
  ms: number,
  status = 200
): Response {
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (status !== 200) {
        controller.close();
        return;
      }
      controller.enqueue(new Uint8Array(bytes));
      await new Promise((r) => setTimeout(r, ms));
      controller.close();
    },
  });
  return new Response(body, {
    status,
    headers: { "Content-Length": String(bytes) },
  });
}

interface FetchOptions {
  pingMs?: number;
  downloadBytes?: number;
  downloadMs?: number;
  uploadMs?: number;
  downloadStatus?: number;
  uploadStatus?: number;
  rejectAll?: boolean;
}

function setupFetch(opts: FetchOptions = {}) {
  const {
    pingMs = 0,
    downloadBytes = MB,
    downloadMs = 0,
    uploadMs = 0,
    downloadStatus = 200,
    uploadStatus = 200,
    rejectAll = false,
  } = opts;

  const calls: Array<{ url: string; method: string }> = [];
  const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ url: u, method });
    if (rejectAll) return Promise.reject(new Error("network down"));

    if (method === "POST") {
      return new Promise<Response>((resolve) =>
        setTimeout(
          () =>
            resolve(
              new Response(
                uploadStatus === 200
                  ? JSON.stringify({ received_bytes: 1 })
                  : "",
                { status: uploadStatus }
              )
            ),
          uploadMs
        )
      );
    }
    if (u.endsWith("/health")) {
      return new Promise<Response>((resolve) =>
        setTimeout(
          () =>
            resolve(
              new Response(JSON.stringify({ status: "ok" }), { status: 200 })
            ),
          pingMs
        )
      );
    }
    return new Promise<Response>((resolve) =>
      setTimeout(
        () =>
          resolve(
            timedDownloadResponse(downloadBytes, downloadMs, downloadStatus)
          ),
        0
      )
    );
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("internetSpeedTest", () => {
  it("passes a healthy link and reports real download bandwidth", async () => {
    // 1 MiB in ~100ms ≈ 80 Mbps (well above the 8 Mbps threshold).
    setupFetch({ downloadBytes: MB, downloadMs: 100, uploadMs: 100 });

    const result = await testInternetSpeed();

    expect(result.passed).toBe(true);
    expect(result.download).toBeGreaterThan(40);
    expect(result.download).toBeLessThan(200);
    expect(result.upload).toBeGreaterThan(40);
    expect(result.ping).toBeLessThanOrEqual(10);
  });

  it("fails when the download bandwidth is below the threshold", async () => {
    // 1 MiB in ~1.5s ≈ 5.6 Mbps < 8 Mbps. Upload stays fast so only the
    // download can be responsible for the failure.
    setupFetch({ downloadBytes: MB, downloadMs: 1500, uploadMs: 100 });

    const result = await testInternetSpeed();

    expect(result.passed).toBe(false);
    expect(result.download).toBeLessThan(8);
    expect(result.upload).toBeGreaterThan(40);
  });

  it("runs samples sequentially against the platform's own API only", async () => {
    const { calls } = setupFetch({ downloadBytes: MB, downloadMs: 10 });

    await testInternetSpeed();

    const labels = calls.map((c) => `${c.method} ${c.url.split("/").pop()}`);
    // ping ×3, then download ×2, then upload ×2 — never interleaved (Promise.all).
    expect(labels).toEqual([
      "GET health",
      "GET health",
      "GET health",
      "GET speed_test",
      "GET speed_test",
      "POST speed_test",
      "POST speed_test",
    ]);
    expect(calls.every((c) => c.url.startsWith("http://localhost"))).toBe(true);
  });

  it("skips failed samples instead of fabricating a failing value", async () => {
    setupFetch({
      downloadBytes: MB,
      downloadMs: 10,
      downloadStatus: 500,
      uploadMs: 10,
    });

    const result = await testInternetSpeed();

    expect(result.download).toBe(0);
    expect(result.downloadTests).toEqual([]);
    expect(result.uploadTests).toHaveLength(2);
    expect(result.passed).toBe(false);
  });

  it("fails the check when nothing could be measured", async () => {
    setupFetch({ rejectAll: true });

    const result = await testInternetSpeed();

    expect(result).toMatchObject({
      download: 0,
      upload: 0,
      ping: 999,
      passed: false,
      downloadTests: [],
      uploadTests: [],
      pingTests: [],
    });
  });
});
