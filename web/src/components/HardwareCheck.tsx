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

const HardwareCheck: React.FC<HardwareCheckProps> = ({ onStart }) => {
    const [progress, setProgress] = useState<HardwareCheckingProgress>({
        osAndBrowser: ProctoringState.WAITING,
        internet: ProctoringState.WAITING,
        camera: ProctoringState.WAITING,
        audio: ProctoringState.WAITING,
        microphone: ProctoringState.WAITING,
    });
    const [allPassed, setAllPassed] = useState(false);
    const [internetResult, setInternetResult] = useState<InternetSpeedResult | null>(null);
    const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
    const [audioLevel, setAudioLevel] = useState<number>(0);
    const videoRef = useRef<HTMLVideoElement>(null);

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

    // Step 1: OS & browser
    useEffect(() => {
        setProgress((p) => ({ ...p, osAndBrowser: ProctoringState.LOADING }));
        setTimeout(() => {
            getBrowserInfo();
            getOSInfo();
            getCurrentTime();
            setProgress((p) => ({
                ...p,
                osAndBrowser: ProctoringState.PASSED,
                internet: ProctoringState.LOADING,
            }));
        }, 800);
    }, []);

    // Step 2: Internet
    useEffect(() => {
        if (progress.internet !== ProctoringState.LOADING) return;
        testInternetSpeed(DEFAULT_THRESHOLDS).then((result) => {
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

    const hasError = Object.values(progress).some((s) => s === ProctoringState.ERROR);

    return (
        <div className="border border-foreground/15 bg-card/80 overflow-hidden">
            {REQUIRE_CAMERA && <div className="relative bg-foreground aspect-video">
                {videoStream ? (
                    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-primary-foreground/50 gap-2">
                        <p className="text-xs tracking-wide uppercase">Camera not active</p>
                    </div>
                )}
                {progress.camera === ProctoringState.PASSED && videoStream && (
                    <span className="absolute bottom-2 left-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider bg-destructive text-destructive-foreground px-2 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        Live
                    </span>
                )}
            </div>}

            <div className="divide-y divide-foreground/10">
                {rows.map(({ key, label }) => (
                    <div key={key} className="px-4 py-3.5">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium">{label}</span>
                            <div className="flex items-center gap-2 shrink-0">
                                <StateIcon state={progress[key]} />
                                <span className={`text-xs w-[4.5rem] text-right tabular-nums ${progress[key] === ProctoringState.PASSED ? "text-primary" :
                                    progress[key] === ProctoringState.ERROR ? "text-destructive" :
                                        "text-muted-foreground"
                                    }`}>
                                    {stateLabel(progress[key])}
                                </span>
                            </div>
                        </div>

                        {key === "internet" && internetResult && (
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
                                <span className={internetResult.download >= thresholds.minDownloadMbps ? "text-primary" : "text-destructive"}>
                                    ↓ {internetResult.download} Mbps
                                </span>
                                <span className={internetResult.upload >= thresholds.minUploadMbps ? "text-primary" : "text-destructive"}>
                                    ↑ {internetResult.upload} Mbps
                                </span>
                                <span className={internetResult.ping <= thresholds.maxPingMs ? "text-primary" : "text-destructive"}>
                                    {internetResult.ping} ms
                                </span>
                            </div>
                        )}

                        {key === "microphone" && progress.microphone === ProctoringState.PASSED && (
                            <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 bg-muted h-1 overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-150"
                                        style={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
                                    />
                                </div>
                                <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">{audioLevel}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="px-4 py-3 border-t border-foreground/10 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-muted/40">
                {hasError ? (
                    <Button variant="outline" size="sm" onClick={retryAll} className="w-full sm:w-auto">
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Retry
                    </Button>
                ) : (
                    <span className="hidden sm:block" />
                )}
                <Button
                    size="sm"
                    className="w-full sm:w-auto sm:ml-auto"
                    disabled={!allPassed}
                    onClick={onStart}
                >
                    Start Interview
                </Button>
            </div>
        </div>
    );
};

export default HardwareCheck;
