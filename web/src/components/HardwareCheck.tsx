import React, { useEffect, useRef, useState } from "react";
import { testInternetSpeed, DEFAULT_THRESHOLDS, type InternetSpeedResult } from "@/utils/internetSpeedTest";
import {
    ProctoringState,
    type HardwareCheckingProgress,
    getBrowserInfo,
    getOSInfo,
    checkCamera,
    getCurrentTime,
} from "@/utils/hardwareUtils";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, XCircle, Loader2, Circle } from "lucide-react";

interface HardwareCheckProps {
    onStart?: () => void;
}

function StateIcon({ state }: { state: ProctoringState }) {
    if (state === ProctoringState.LOADING)
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    if (state === ProctoringState.PASSED)
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (state === ProctoringState.ERROR)
        return <XCircle className="h-4 w-4 text-destructive" />;
    return <Circle className="h-4 w-4 text-muted-foreground/40" />;
}

function stateLabel(state: ProctoringState) {
    if (state === ProctoringState.LOADING) return "Checking...";
    if (state === ProctoringState.PASSED) return "Passed";
    if (state === ProctoringState.ERROR) return "Failed";
    return "Waiting";
}

const REQUIRE_CAMERA = import.meta.env.VITE_REQUIRE_CAMERA === "true";

const INITIAL_PROGRESS: HardwareCheckingProgress = {
    osAndBrowser: ProctoringState.LOADING,
    internet: ProctoringState.WAITING,
    camera: ProctoringState.WAITING,
    audio: ProctoringState.WAITING,
    microphone: ProctoringState.WAITING,
};

const HardwareCheck: React.FC<HardwareCheckProps> = ({ onStart }) => {
    const [progress, setProgress] = useState<HardwareCheckingProgress>(INITIAL_PROGRESS);
    const [allPassed, setAllPassed] = useState(false);
    const [internetResult, setInternetResult] = useState<InternetSpeedResult | null>(null);
    const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
    const [audioLevel, setAudioLevel] = useState<number>(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    /** Bumps on retry so stale async results from a previous run are ignored. */
    const runIdRef = useRef(0);
    const audioRafRef = useRef<number | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        const { osAndBrowser, internet, camera, audio, microphone } = progress;
        setAllPassed(
            osAndBrowser === ProctoringState.PASSED &&
            internet === ProctoringState.PASSED &&
            camera === ProctoringState.PASSED &&
            audio === ProctoringState.PASSED &&
            microphone === ProctoringState.PASSED
        );
    }, [progress]);

    useEffect(() => {
        if (videoRef.current && videoStream) videoRef.current.srcObject = videoStream;
    }, [videoStream]);

    useEffect(() => {
        return () => {
            videoStream?.getTracks().forEach((t) => t.stop());
            if (audioRafRef.current != null) cancelAnimationFrame(audioRafRef.current);
            audioCtxRef.current?.close().catch(() => {});
        };
    }, [videoStream]);

    const stopAudioMonitoring = () => {
        if (audioRafRef.current != null) {
            cancelAnimationFrame(audioRafRef.current);
            audioRafRef.current = null;
        }
        if (audioCtxRef.current) {
            audioCtxRef.current.close().catch(() => {});
            audioCtxRef.current = null;
        }
        setAudioLevel(0);
    };

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
            await ctx.close().catch(() => {});
            return true;
        } catch {
            return false;
        }
    };

    const startAudioLevelMonitoring = (stream: MediaStream) => {
        stopAudioMonitoring();
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioCtx();
            audioCtxRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            const update = () => {
                analyser.getByteFrequencyData(data);
                setAudioLevel(Math.round(data.reduce((a, b) => a + b, 0) / data.length));
                audioRafRef.current = requestAnimationFrame(update);
            };
            audioRafRef.current = requestAnimationFrame(update);
        } catch {
            /* silent */
        }
    };

    // Step 1: OS & browser — also re-runs on Retry (osAndBrowser → LOADING)
    useEffect(() => {
        if (progress.osAndBrowser !== ProctoringState.LOADING) return;
        const runId = runIdRef.current;
        const t = setTimeout(() => {
            if (runId !== runIdRef.current) return;
            getBrowserInfo();
            getOSInfo();
            getCurrentTime();
            setProgress((p) => ({
                ...p,
                osAndBrowser: ProctoringState.PASSED,
                internet: ProctoringState.LOADING,
            }));
        }, 400);
        return () => clearTimeout(t);
    }, [progress.osAndBrowser]);

    // Step 2: Internet
    useEffect(() => {
        if (progress.internet !== ProctoringState.LOADING) return;
        const runId = runIdRef.current;
        testInternetSpeed(DEFAULT_THRESHOLDS).then((result) => {
            if (runId !== runIdRef.current) return;
            setInternetResult(result);
            setProgress((p) => ({
                ...p,
                internet: result.passed ? ProctoringState.PASSED : ProctoringState.ERROR,
                ...(result.passed
                    ? REQUIRE_CAMERA
                        ? { camera: ProctoringState.LOADING }
                        : { camera: ProctoringState.PASSED, microphone: ProctoringState.LOADING }
                    : {}),
            }));
        });
    }, [progress.internet]);

    // Step 3: Camera + microphone (or microphone-only when camera disabled)
    useEffect(() => {
        const cameraLoading = progress.camera === ProctoringState.LOADING;
        const micLoading = !REQUIRE_CAMERA && progress.microphone === ProctoringState.LOADING;
        if (!cameraLoading && !micLoading) return;

        const runId = runIdRef.current;
        const getStream = REQUIRE_CAMERA
            ? checkCamera()
            : navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);

        getStream.then((stream) => {
            if (runId !== runIdRef.current) {
                stream?.getTracks().forEach((t) => t.stop());
                return;
            }
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
        const runId = runIdRef.current;
        checkAudioPlayback().then((ok) => {
            if (runId !== runIdRef.current) return;
            setProgress((p) => ({
                ...p,
                audio: ok ? ProctoringState.PASSED : ProctoringState.ERROR,
            }));
        });
    }, [progress.audio]);

    const retryAll = () => {
        runIdRef.current += 1;
        videoStream?.getTracks().forEach((t) => t.stop());
        setVideoStream(null);
        stopAudioMonitoring();
        setInternetResult(null);
        setProgress({ ...INITIAL_PROGRESS });
    };

    const thresholds = DEFAULT_THRESHOLDS;

    const rows: { key: keyof HardwareCheckingProgress; label: string }[] = [
        { key: "osAndBrowser", label: "OS & browser" },
        { key: "internet", label: "Internet" },
        ...(REQUIRE_CAMERA ? [{ key: "camera" as const, label: "Camera" }] : []),
        { key: "microphone", label: "Microphone" },
        { key: "audio", label: "Audio output" },
    ];

    const hasError = Object.values(progress).some((s) => s === ProctoringState.ERROR);
    const isBusy = Object.values(progress).some((s) => s === ProctoringState.LOADING);

    return (
        <div className="rounded-lg border bg-card overflow-hidden">
            {REQUIRE_CAMERA && (
                <div className="relative bg-black aspect-video">
                    {videoStream ? (
                        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
                            <svg className="w-10 h-10 opacity-30" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                    fillRule="evenodd"
                                    d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                                    clipRule="evenodd"
                                />
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
                </div>
            )}

            <div className="divide-y">
                {rows.map(({ key, label }) => (
                    <div key={key} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{label}</span>
                            <div className="flex items-center gap-2">
                                <StateIcon state={progress[key]} />
                                <span
                                    className={`text-xs w-16 text-right ${
                                        progress[key] === ProctoringState.PASSED
                                            ? "text-green-600"
                                            : progress[key] === ProctoringState.ERROR
                                              ? "text-destructive"
                                              : "text-muted-foreground"
                                    }`}
                                >
                                    {stateLabel(progress[key])}
                                </span>
                            </div>
                        </div>

                        {key === "internet" && internetResult && (
                            <div className="mt-2 flex gap-3 text-xs">
                                <span
                                    className={
                                        internetResult.download >= thresholds.minDownloadMbps
                                            ? "text-green-600"
                                            : "text-destructive"
                                    }
                                >
                                    ↓ {internetResult.download} Mbps
                                </span>
                                <span
                                    className={
                                        internetResult.upload >= thresholds.minUploadMbps
                                            ? "text-green-600"
                                            : "text-destructive"
                                    }
                                >
                                    ↑ {internetResult.upload} Mbps
                                </span>
                                <span
                                    className={
                                        internetResult.ping <= thresholds.maxPingMs
                                            ? "text-green-600"
                                            : "text-destructive"
                                    }
                                >
                                    {internetResult.ping} ms
                                </span>
                            </div>
                        )}

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

            <div className="px-4 py-3 border-t flex items-center justify-between gap-3 bg-muted/30">
                {hasError && (
                    <Button variant="outline" size="sm" onClick={retryAll} disabled={isBusy}>
                        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isBusy ? "animate-spin" : ""}`} />
                        Retry
                    </Button>
                )}
                <Button size="sm" className="ml-auto" disabled={!allPassed} onClick={onStart}>
                    Start Interview
                </Button>
            </div>
        </div>
    );
};

export default HardwareCheck;
