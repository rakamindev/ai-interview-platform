import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testInternetSpeed, DEFAULT_THRESHOLDS } from "@/utils/internetSpeedTest";

// Any request to a third-party host is a UU PDP violation for this finding (F-13).
const EXTERNAL_HOST = /google\.com|jsdelivr\.net|unpkg\.com|httpbin\.org|postman-echo\.com/;

const DEFAULT_API_BASE = "http://localhost:3000/api/v1";

function bodyResponse(bytes: number): Response {
    return new Response(new ArrayBuffer(bytes), { status: 200 });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    fetchMock = vi.fn(async () => bodyResponse(1024 * 1024));
    vi.stubGlobal("fetch", fetchMock);
    // Clean slate: no speed-test overrides, no API base override → code must fall back to
    // the platform's own endpoints.
    vi.stubEnv("VITE_API_BASE_URL", undefined);
    vi.stubEnv("VITE_SPEED_TEST_PING_URL", undefined);
    vi.stubEnv("VITE_SPEED_TEST_DOWNLOAD_URL", undefined);
    vi.stubEnv("VITE_SPEED_TEST_UPLOAD_URL", undefined);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe("testInternetSpeed — self-hosted only (F-13)", () => {
    it("sends all speed-test traffic to the platform's own endpoints, never third-party hosts", async () => {
        const result = await testInternetSpeed(DEFAULT_THRESHOLDS);

        const calledUrls = fetchMock.mock.calls.map((c) => String(c[0]));
        expect(calledUrls.length).toBeGreaterThan(0);

        for (const url of calledUrls) {
            expect(url.startsWith(DEFAULT_API_BASE)).toBe(true);
            expect(url).not.toMatch(EXTERNAL_HOST);
        }

        // Ping → GET /health ; download → GET /speed_test?bytes=… ; upload → POST /speed_test
        expect(calledUrls.some((u) => u === `${DEFAULT_API_BASE}/health`)).toBe(true);
        expect(calledUrls.some((u) => u.startsWith(`${DEFAULT_API_BASE}/speed_test?bytes=`))).toBe(true);
        expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true);

        expect(result.unavailable).toBe(false);
    });

    it("respects VITE_SPEED_TEST_* overrides pointing at internal endpoints", async () => {
        vi.stubEnv("VITE_SPEED_TEST_PING_URL", "https://cdn.internal.example.com/health");
        vi.stubEnv("VITE_SPEED_TEST_DOWNLOAD_URL", "https://cdn.internal.example.com/speed_test?bytes=1048576");
        vi.stubEnv("VITE_SPEED_TEST_UPLOAD_URL", "https://cdn.internal.example.com/speed_test");

        await testInternetSpeed(DEFAULT_THRESHOLDS);

        const calledUrls = fetchMock.mock.calls.map((c) => String(c[0]));
        expect(calledUrls.length).toBeGreaterThan(0);
        expect(calledUrls.every((u) => u.startsWith("https://cdn.internal.example.com/"))).toBe(true);
    });

    it("marks the test unavailable when the own endpoint is unreachable", async () => {
        fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

        const result = await testInternetSpeed(DEFAULT_THRESHOLDS);

        expect(result.unavailable).toBe(true);
        expect(result.passed).toBe(false);
    });

    it("fails (not unavailable) when measurements are below threshold", async () => {
        // All three metrics are measured (health + speed_test respond), but the download is
        // tiny and slow → measured ≈ 0.004 Mbps, far below the 8 Mbps minimum.
        fetchMock.mockImplementation(async (url: string | URL, init?: RequestInit) => {
            if (!init?.method && String(url).includes("/speed_test")) {
                await new Promise((r) => setTimeout(r, 200));
                return bodyResponse(100);
            }
            return bodyResponse(1024 * 1024);
        });

        const result = await testInternetSpeed(DEFAULT_THRESHOLDS);

        expect(result.passed).toBe(false);
        expect(result.unavailable).toBe(false);
    });

    it("marks the test unavailable when only the speed_test endpoint is down (health still up)", async () => {
        // Reproduces the real failure mode: blocking *speed_test* requests kills download + upload,
        // while the ping (health) check still succeeds. The measurement is incomplete → skip,
        // NOT a hard failure (F-13 AC #3).
        fetchMock.mockImplementation(async (url: string | URL, init?: RequestInit) => {
            if (String(url).includes("/speed_test")) throw new TypeError("Failed to fetch");
            return bodyResponse(1024 * 1024);
        });

        const result = await testInternetSpeed(DEFAULT_THRESHOLDS);

        expect(result.unavailable).toBe(true);
        expect(result.passed).toBe(false);
    });
});
