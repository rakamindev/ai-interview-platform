// Internet Speed Test Utilities — standalone, no backend dependency

export interface InternetSpeedResult {
    download: number;
    upload: number;
    ping: number;
    passed: boolean;
    measurementAvailable: boolean;
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
    minUploadMbps: 0.2,
    maxPingMs: 300,
};

const SPEED_TEST_PING_URL = import.meta.env
    .VITE_SPEED_TEST_PING_URL as string | undefined;

const SPEED_TEST_UPLOAD_URL = import.meta.env
    .VITE_SPEED_TEST_UPLOAD_URL as string | undefined;

const DOWNLOAD_TEST_URLS = [
    "https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js",
    "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css",
    "https://unpkg.com/react@18/umd/react.production.min.js",
];

const UPLOAD_TEST_URLS = SPEED_TEST_UPLOAD_URL
    ? [SPEED_TEST_UPLOAD_URL]
    : [
          "https://httpbin.org/post",
          "https://postman-echo.com/post",
      ];

const UPLOAD_SIZE_BYTES = 512 * 1024;

type Measurement = number | null;

async function measurePing(): Promise<Measurement> {
    const urls = SPEED_TEST_PING_URL
        ? [SPEED_TEST_PING_URL]
        : DOWNLOAD_TEST_URLS;

    for (const url of urls) {
        try {
            const start = performance.now();

            const response = await fetch(url, {
                cache: "no-store",
            });

            const elapsedMs = performance.now() - start;

            if (!response.ok || !Number.isFinite(elapsedMs)) {
                continue;
            }

            return elapsedMs;
        } catch {
            // Try the next endpoint.
        }
    }

    return null;
}

async function measureDownloadSpeed(): Promise<Measurement> {
    for (const url of DOWNLOAD_TEST_URLS) {
        try {
            const start = performance.now();

            const response = await fetch(url, {
                cache: "no-store",
            });

            if (!response.ok) {
                continue;
            }

            const data = await response.blob();
            const elapsedSeconds =
                (performance.now() - start) / 1000;

            if (
                data.size <= 0 ||
                elapsedSeconds <= 0 ||
                !Number.isFinite(elapsedSeconds)
            ) {
                continue;
            }

            return data.size / (1024 * 1024) / elapsedSeconds;
        } catch {
            // Try the next download endpoint.
        }
    }

    return null;
}

async function measureUploadSpeed(): Promise<Measurement> {
    const uploadData = new Blob(
        [new Uint8Array(UPLOAD_SIZE_BYTES)],
        { type: "application/octet-stream" }
    );

    for (const endpoint of UPLOAD_TEST_URLS) {
        try {
            const formData = new FormData();

            formData.append(
                "test",
                uploadData,
                "speed-test.bin"
            );

            const start = performance.now();

            const response = await fetch(endpoint, {
                method: "POST",
                body: formData,
                cache: "no-store",
            });

            const elapsedSeconds =
                (performance.now() - start) / 1000;

            if (
                !response.ok ||
                elapsedSeconds <= 0 ||
                !Number.isFinite(elapsedSeconds)
            ) {
                continue;
            }

            return (
                UPLOAD_SIZE_BYTES /
                (1024 * 1024) /
                elapsedSeconds
            );
        } catch {
            // Try the next upload endpoint.
        }
    }

    return null;
}

async function runMultipleTests(
    testFn: () => Promise<Measurement>,
    count = 3
): Promise<number[]> {
    const results: number[] = [];

    for (let i = 0; i < count; i++) {
        try {
            const result = await testFn();

            if (
                result !== null &&
                Number.isFinite(result) &&
                result >= 0
            ) {
                results.push(result);
            }
        } catch {
            // Do not replace failed tests with fabricated values.
        }

        if (i < count - 1) {
            await new Promise((resolve) =>
                setTimeout(resolve, 100)
            );
        }
    }

    return results;
}

function average(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }

    if (values.length <= 2) {
        return (
            values.reduce((sum, value) => sum + value, 0) /
            values.length
        );
    }

    const sorted = [...values].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);

    return (
        trimmed.reduce((sum, value) => sum + value, 0) /
        trimmed.length
    );
}

export async function testInternetSpeed(
    thresholds: SpeedThresholds = DEFAULT_THRESHOLDS
): Promise<InternetSpeedResult> {
    try {
        const [
            downloadTests,
            uploadTests,
            pingTests,
        ] = await Promise.all([
            runMultipleTests(measureDownloadSpeed, 3),
            runMultipleTests(measureUploadSpeed, 3),
            runMultipleTests(measurePing, 3),
        ]);

        const measurementAvailable =
            downloadTests.length > 0 &&
            uploadTests.length > 0 &&
            pingTests.length > 0;

        const downloadMbps = average(downloadTests) * 8;
        const uploadMbps = average(uploadTests) * 8;
        const ping = average(pingTests);

        const passed =
            measurementAvailable &&
            downloadMbps >= thresholds.minDownloadMbps &&
            uploadMbps >= thresholds.minUploadMbps &&
            ping <= thresholds.maxPingMs;

        return {
            download: Math.round(downloadMbps * 100) / 100,
            upload: Math.round(uploadMbps * 100) / 100,
            ping: Math.round(ping),
            passed,
            measurementAvailable,
            downloadTests: downloadTests.map(
                (value) =>
                    Math.round(value * 8 * 100) / 100
            ),
            uploadTests: uploadTests.map(
                (value) =>
                    Math.round(value * 8 * 100) / 100
            ),
            pingTests: pingTests.map(
                (value) => Math.round(value)
            ),
        };
    } catch {
        return {
            download: 0,
            upload: 0,
            ping: 999,
            passed: false,
            measurementAvailable: false,
            downloadTests: [],
            uploadTests: [],
            pingTests: [],
        };
    }
}
