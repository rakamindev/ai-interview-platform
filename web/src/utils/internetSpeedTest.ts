
import SpeedTest from "@cloudflare/speedtest";

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

function failedResult(): InternetSpeedResult {
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

export async function testInternetSpeed(
    thresholds: SpeedThresholds = DEFAULT_THRESHOLDS
): Promise<InternetSpeedResult> {
    return new Promise((resolve) => {
        const engine = new SpeedTest({
            autoStart: false,

            // Tidak mengirim hasil pengujian ke endpoint logging.
            logAimApiUrl: null,
            logMeasurementApiUrl: null,

            // Pengujian lebih ringan.
            measurements: [
                { type: "latency", numPackets: 5 },
                { type: "download", bytes: 1_000_000, count: 3 },
                { type: "upload", bytes: 1_000_000, count: 3 },
            ],

            // Tidak mengukur latency ketika transfer berlangsung.
            measureDownloadLoadedLatency: false,
            measureUploadLoadedLatency: false,

            // Batas durasi.
            abortRequestDuration: 8_000,
            abortTestDuration: 20_000,
        });

        let settled = false;

        const timeoutId = window.setTimeout(() => {
            if (settled) return;

            settled = true;
            engine.pause();
            resolve(failedResult());
        }, 30_000);

        engine.onFinish = (results) => {
            if (settled) return;

            settled = true;
            window.clearTimeout(timeoutId);

            try {
                const downloadBps = results.getDownloadBandwidth();
                const uploadBps = results.getUploadBandwidth();
                const pingMs = results.getUnloadedLatency();

                const valid =
                    typeof downloadBps === "number" &&
                    Number.isFinite(downloadBps) &&
                    downloadBps > 0 &&
                    typeof uploadBps === "number" &&
                    Number.isFinite(uploadBps) &&
                    uploadBps > 0 &&
                    typeof pingMs === "number" &&
                    Number.isFinite(pingMs) &&
                    pingMs > 0;

                if (!valid) {
                    resolve(failedResult());
                    return;
                }

                const download =
                    Math.round((downloadBps / 1_000_000) * 100) / 100;

                const upload =
                    Math.round((uploadBps / 1_000_000) * 100) / 100;

                const ping = Math.round(pingMs);

                resolve({
                    download,
                    upload,
                    ping,
                    passed:
                        download >= thresholds.minDownloadMbps &&
                        upload >= thresholds.minUploadMbps &&
                        ping <= thresholds.maxPingMs,
                    downloadTests: [download],
                    uploadTests: [upload],
                    pingTests: [ping],
                });
            } catch (error) {
                console.error("Failed to process Cloudflare results:", error);
                resolve(failedResult());
            }
        };

        engine.onError = (message, status) => {
            console.error("Cloudflare Speed Test error:", message, status);
        };

        engine.play();
    });
}
