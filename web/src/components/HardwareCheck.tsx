import React, { useEffect, useRef, useState } from "react";
import {
    testInternetSpeed,
    DEFAULT_THRESHOLDS,
    type ConnectionQuality,
    type InternetSpeedResult,
} from "@/utils/internetSpeedTest";
import {
    ProctoringState,
    type HardwareCheckingProgress,
    getBrowserInfo,
    getOSInfo,
    checkCamera,
    getCurrentTime,
} from "@/utils/hardwareUtils";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, XCircle, Loader2, Circle, AlertTriangle } from "lucide-react";

interface HardwareCheckProps {
    onStart?: () => void;
}

function StateIcon({ state }: { state: ProctoringState }) {
    if (state === ProctoringState.LOADING)
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    if (state === ProctoringState.PASSED)
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (state === ProctoringState.WARNING)
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    if (state === ProctoringState.ERROR)
        return <XCircle className="h-4 w-4 text-destructive" />;
    return <Circle className="h-4 w-4 text-muted-foreground/40" />;
}

function stateLabel(state: ProctoringState) {
    if (state === ProctoringState.LOADING) return "Checking...";
    if (state === ProctoringState.PASSED) return "Passed";
    if (state === ProctoringState.WARNING) return "Warning";
    if (state === ProctoringState.ERROR) return "Failed";
    return "Waiting";
}

const REQUIRE_CAMERA = import.meta.env.VITE_REQUIRE_CAMERA === "true";

const INTERNET_STATE: Record<ConnectionQuality, ProctoringState> = {
    good: ProctoringState.PASSED,
    fair: ProctoringState.WARNING,
    unknown: ProctoringState.WARNING,
    poor: ProctoringState.ERROR,
};

const INTERNET_LABEL: Record<ConnectionQuality, string> = {
    good: "Passed",
    fair: "Slow",
    unknown: "Unverified",
    poor: "Too slow",
};

function metricTone(value: number | null, min: number, recommended: number, higherIsBetter: boolean) {
    if (value === null) return "text-muted-foreground";
    const meets = (limit: number) => (higherIsBetter ? value >= limit : value <= limit);
    if (meets(recommended)) return "text-green-600";
    return meets(min) ? "text-amber-600" : "text-destructive";
}

const formatMetric = (value: number | null) => (value === null ? "—" : value);

const HardwareCheck: React.FC<HardwareCheckProps> = ({ onStart }) => {
    const [progress, setProgress] = useState<HardwareCheckingProgress>({
        osAndBrowser: ProctoringState.LOADING,
        internet: ProctoringState.WAITING,
        camera: ProctoringState.WAITING,
        audio: ProctoringState.WAITING,
        microphone: ProctoringState.WAITING,
    });
    const [internetResult, setInternetResult] = useState<InternetSpeedResult | null>(null);
    const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
    const [audioLevel, setAudioLevel] = useState<number>(0);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && videoStream) videoRef.current.srcObject = videoStream;
    }, [videoStream]);

    useEffect(() => {
        return () => { videoStream?.getTracks().forEach((t) => t.stop()); };
    }, [videoStream]);

    const checkAudioPlayback = async (): Promise<boolean> => {
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioCtx();
            if (ctx.state === "suspended") await ctx.resume();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            gain.gain.setValueAtTime(0.01, ctx.currentTime);
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.1);
            return true;
        } catch { return false; }
    };

    const startAudioLevelMonitoring = (stream: MediaStream) => {
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioCtx();
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            const update = () => {
                analyser.getByteFrequencyData(data);
                setAudioLevel(Math.round(data.reduce((a, b) => a + b, 0) / data.length));
                requestAnimationFrame(update);
            };
            update();
        } catch { /* silent */ }
    };

    // Step 1: OS & browser (re-runs whenever Retry resets it to LOADING)
    useEffect(() => {
        if (progress.osAndBrowser !== ProctoringState.LOADING) return;
        const timer = setTimeout(() => {
            getBrowserInfo();
            getOSInfo();
            getCurrentTime();
            setProgress((p) => ({
                ...p,
                osAndBrowser: ProctoringState.PASSED,
                internet: ProctoringState.LOADING,
            }));
        }, 800);
        return () => clearTimeout(timer);
    }, [progress.osAndBrowser]);

    // Step 2: Internet
    useEffect(() => {
        if (progress.internet !== ProctoringState.LOADING) return;
        testInternetSpeed(DEFAULT_THRESHOLDS).then((result) => {
            setInternetResult(result);
            setProgress((p) => ({
                ...p,
                internet: INTERNET_STATE[result.quality],
                // Continue whatever the result, so the candidate sees every problem at once instead of one at a time.
                ...(REQUIRE_CAMERA
                    ? { camera: ProctoringState.LOADING }
                    : { camera: ProctoringState.PASSED, microphone: ProctoringState.LOADING }),
            }));
        });
    }, [progress.internet]);

    // Step 3: Camera + microphone (or microphone-only when camera disabled)
    useEffect(() => {
        const cameraLoading = progress.camera === ProctoringState.LOADING;
        const micLoading = !REQUIRE_CAMERA && progress.microphone === ProctoringState.LOADING;
        if (!cameraLoading && !micLoading) return;

        const getStream = REQUIRE_CAMERA
            ? checkCamera()
            : navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);

        getStream.then((stream) => {
            if (stream) {
                if (REQUIRE_CAMERA) setVideoStream(stream);
                startAudioLevelMonitoring(stream);
                setProgress((p) => ({
                    ...p,
                    ...(REQUIRE_CAMERA ? { camera: ProctoringState.PASSED } : {}),
                    microphone: ProctoringState.PASSED,
                    audio: ProctoringState.LOADING,
                }));
            } else {
                setProgress((p) => ({
                    ...p,
                    ...(REQUIRE_CAMERA ? { camera: ProctoringState.ERROR } : {}),
                    microphone: ProctoringState.ERROR,
                }));
            }
        });
    }, [progress.camera, progress.microphone]);

    // Step 4: Audio output
    useEffect(() => {
        if (progress.audio !== ProctoringState.LOADING) return;
        checkAudioPlayback().then((ok) => {
            setProgress((p) => ({
                ...p,
                audio: ok ? ProctoringState.PASSED : ProctoringState.ERROR,
            }));
        });
    }, [progress.audio]);

    const retryAll = () => {
        videoStream?.getTracks().forEach((t) => t.stop());
        setVideoStream(null);
        setInternetResult(null);
        setProgress({
            osAndBrowser: ProctoringState.LOADING,
            internet: ProctoringState.WAITING,
            camera: ProctoringState.WAITING,
            audio: ProctoringState.WAITING,
            microphone: ProctoringState.WAITING,
        });
    };

    const thresholds = DEFAULT_THRESHOLDS;

    const rows: { key: keyof HardwareCheckingProgress; label: string }[] = [
        { key: "osAndBrowser", label: "OS & browser" },
        { key: "internet", label: "Internet" },
        ...(REQUIRE_CAMERA ? [{ key: "camera" as const, label: "Camera" }] : []),
        { key: "microphone", label: "Microphone" },
        { key: "audio", label: "Audio output" },
    ];

    const states = Object.values(progress);
    const canStart = states.every((s) => s === ProctoringState.PASSED || s === ProctoringState.WARNING);
    const busy = states.some((s) => s === ProctoringState.LOADING);
    const hasProblem = states.some((s) => s === ProctoringState.ERROR || s === ProctoringState.WARNING);

    const rowLabel = (key: keyof HardwareCheckingProgress) =>
        key === "internet" && internetResult && progress.internet !== ProctoringState.LOADING
            ? INTERNET_LABEL[internetResult.quality]
            : stateLabel(progress[key]);

    const internetMessage: Partial<Record<ConnectionQuality, string>> = {
        fair: "Your connection is slower than recommended. You can continue, but the audio may lag. If you can, move closer to your router or switch networks first.",
        unknown: "We couldn't fully measure your connection. You can continue. If the audio cuts out, try a different network.",
        poor: `Your connection is too slow or unstable for a live audio interview. It needs at least ${thresholds.minUploadMbps} Mbps upload and ${thresholds.minDownloadMbps} Mbps download. Try another Wi-Fi network or mobile data, then press Retry.`,
    };

    return (
        <div className="rounded-lg border bg-card overflow-hidden">
            {/* Camera preview */}
            {REQUIRE_CAMERA && <div className="relative bg-black aspect-video">
                {videoStream ? (
                    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
                        <svg className="w-10 h-10 opacity-30" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xs">Camera not active</p>
                    </div>
                )}
                {progress.camera === ProctoringState.PASSED && videoStream && (
                    <span className="absolute bottom-2 left-2 flex items-center gap-1 text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        LIVE
                    </span>
                )}
            </div>}

            {/* Checklist */}
            <div className="divide-y">
                {rows.map(({ key, label }) => (
                    <div key={key} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{label}</span>
                            <div className="flex items-center gap-2">
                                <StateIcon state={progress[key]} />
                                <span className={`text-xs w-20 text-right ${progress[key] === ProctoringState.PASSED ? "text-green-600" :
                                    progress[key] === ProctoringState.WARNING ? "text-amber-600" :
                                        progress[key] === ProctoringState.ERROR ? "text-destructive" :
                                            "text-muted-foreground"
                                    }`}>
                                    {rowLabel(key)}
                                </span>
                            </div>
                        </div>

                        {/* Internet speed details */}
                        {key === "internet" && internetResult && progress.internet !== ProctoringState.LOADING && (
                            <>
                                <div className="mt-2 flex gap-3 text-xs">
                                    <span className={metricTone(internetResult.download, thresholds.minDownloadMbps, thresholds.recommendedDownloadMbps, true)}>
                                        ↓ {formatMetric(internetResult.download)} Mbps
                                    </span>
                                    <span className={metricTone(internetResult.upload, thresholds.minUploadMbps, thresholds.recommendedUploadMbps, true)}>
                                        ↑ {formatMetric(internetResult.upload)} Mbps
                                    </span>
                                    <span className={metricTone(internetResult.ping, thresholds.maxPingMs, thresholds.recommendedPingMs, false)}>
                                        {formatMetric(internetResult.ping)} ms
                                    </span>
                                </div>
                                {internetMessage[internetResult.quality] && (
                                    <p
                                        role={internetResult.quality === "poor" ? "alert" : "status"}
                                        className={`mt-2 rounded-md border px-3 py-2 text-xs leading-relaxed ${internetResult.quality === "poor"
                                            ? "border-destructive/30 bg-destructive/5 text-destructive"
                                            : "border-amber-200 bg-amber-50 text-amber-700"
                                            }`}
                                    >
                                        {internetMessage[internetResult.quality]}
                                    </p>
                                )}
                            </>
                        )}

                        {/* Mic level bar */}
                        {key === "microphone" && progress.microphone === ProctoringState.PASSED && (
                            <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                                    <div
                                        className="h-full bg-green-500 transition-all duration-150"
                                        style={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
                                    />
                                </div>
                                <span className="text-xs text-muted-foreground w-8 text-right">{audioLevel}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t flex items-center justify-between gap-3 bg-muted/30">
                {hasProblem && !busy && (
                    <Button variant="outline" size="sm" onClick={retryAll}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Retry
                    </Button>
                )}
                <Button
                    size="sm"
                    className="ml-auto"
                    disabled={!canStart}
                    onClick={onStart}
                >
                    Start Interview
                </Button>
            </div>
        </div>
    );
};

export default HardwareCheck;
