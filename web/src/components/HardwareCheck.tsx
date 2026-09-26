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
import { RefreshCw, CheckCircle, XCircle, Loader2, Circle, AlertCircle } from "lucide-react";

interface HardwareCheckProps {
    /** Called when user confirms they want to start. Only fired when all checks pass. */
    onStart?: () => void;
    /** Set to false while sessionId is still loading from the API — disables Start even when checks pass. */
    sessionReady?: boolean;
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

// When camera is not required it is always treated as passed — it is excluded from the check pipeline.
const CAMERA_INITIAL: ProctoringState = REQUIRE_CAMERA
    ? ProctoringState.WAITING
    : ProctoringState.PASSED;

function initialProgress(): HardwareCheckingProgress {
    return {
        osAndBrowser: ProctoringState.WAITING,
        internet: ProctoringState.WAITING,
        camera: CAMERA_INITIAL,
        audio: ProctoringState.WAITING,
        microphone: ProctoringState.WAITING,
    };
}

const HardwareCheck: React.FC<HardwareCheckProps> = ({ onStart, sessionReady = true }) => {
    const [progress, setProgress] = useState<HardwareCheckingProgress>(initialProgress());
    const [allPassed, setAllPassed] = useState(false);
    const [internetResult, setInternetResult] = useState<InternetSpeedResult | null>(null);
    const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
    const [audioLevel, setAudioLevel] = useState<number>(0);
    const [micError, setMicError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const animFrameRef = useRef<number | null>(null);

    // ── allPassed — exclude camera when REQUIRE_CAMERA=false ─────────────────
    // BUG FIX: previously camera was always included even when flag is false,
    // meaning allPassed could never be true after a retry (camera stayed WAITING).
    useEffect(() => {
        const { osAndBrowser, internet, camera, audio, microphone } = progress;
        const cameraOk = REQUIRE_CAMERA ? camera === ProctoringState.PASSED : true;
        setAllPassed(
            osAndBrowser === ProctoringState.PASSED &&
            internet === ProctoringState.PASSED &&
            cameraOk &&
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
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
            audioContextRef.current?.close();
        };
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
            gain.gain.setValueAtTime(0.01, ctx.currentTime); // near-silent test tone
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
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            const update = () => {
                analyser.getByteFrequencyData(data);
                setAudioLevel(Math.round(data.reduce((a, b) => a + b, 0) / data.length));
                animFrameRef.current = requestAnimationFrame(update);
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

    // Step 2: Internet — now tests download speed + API latency only (no upload)
    useEffect(() => {
        if (progress.internet !== ProctoringState.LOADING) return;
        testInternetSpeed(DEFAULT_THRESHOLDS).then((result) => {
            setInternetResult(result);
            setProgress((p) => ({
                ...p,
                internet: result.passed ? ProctoringState.PASSED : ProctoringState.ERROR,
                // BUG FIX: when REQUIRE_CAMERA=false, advance to microphone check directly
                // and keep camera at PASSED (its default when camera is disabled).
                ...(result.passed
                    ? REQUIRE_CAMERA
                        ? { camera: ProctoringState.LOADING }
                        : { microphone: ProctoringState.LOADING }
                    : {}),
            }));
        });
    }, [progress.internet]);

    // Step 3: Camera + microphone (or microphone-only when camera disabled)
    useEffect(() => {
        const cameraLoading = REQUIRE_CAMERA && progress.camera === ProctoringState.LOADING;
        const micLoading = !REQUIRE_CAMERA && progress.microphone === ProctoringState.LOADING;
        if (!cameraLoading && !micLoading) return;

        setMicError(null);

        const getStream = REQUIRE_CAMERA
            ? checkCamera()
            : navigator.mediaDevices
                .getUserMedia({ audio: true })
                .catch((err: Error) => {
                    const name = err.name;
                    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
                        setMicError("Microphone access denied. Open browser settings and allow mic access, then retry.");
                    } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
                        setMicError("No microphone found. Connect a microphone and retry.");
                    } else {
                        setMicError("Could not access microphone. Check your device settings and retry.");
                    }
                    return null;
                });

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

    // ── Retry — BUG FIX ──────────────────────────────────────────────────────
    // Previously: retryAll() set camera: WAITING, but when REQUIRE_CAMERA=false,
    // camera was never set back to PASSED, so allPassed stayed false permanently.
    const retryAll = () => {
        videoStream?.getTracks().forEach((t) => t.stop());
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        audioContextRef.current?.close().catch(() => {});
        audioContextRef.current = null;
        setVideoStream(null);
        setInternetResult(null);
        setMicError(null);
        setAudioLevel(0);
        setProgress({
            osAndBrowser: ProctoringState.LOADING,
            internet: ProctoringState.WAITING,
            // REQUIRE_CAMERA=false → camera is always PASSED; never re-check it
            camera: CAMERA_INITIAL,
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
    const isChecking = Object.values(progress).some((s) => s === ProctoringState.LOADING || s === ProctoringState.WAITING);

    // Determine start button state with clear priority:
    // 1. Session not ready (still fetching from API) → disabled + loading label
    // 2. Checks not all passed → disabled
    // 3. Ready → enabled
    const startDisabled = !allPassed || !sessionReady;
    const startLabel = !sessionReady
        ? "Loading..."
        : isChecking
        ? "Checking..."
        : allPassed
        ? "Start Interview"
        : "Fix issues above";

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
                                <span className={`text-xs w-16 text-right ${
                                    progress[key] === ProctoringState.PASSED ? "text-green-600" :
                                    progress[key] === ProctoringState.ERROR ? "text-destructive" :
                                    "text-muted-foreground"
                                }`}>
                                    {stateLabel(progress[key])}
                                </span>
                            </div>
                        </div>

                        {/* Internet speed details */}
                        {key === "internet" && internetResult && (
                            <div className="mt-2 flex flex-wrap gap-3 text-xs">
                                <span className={internetResult.download >= thresholds.minDownloadMbps ? "text-green-600" : "text-destructive"}>
                                    ↓ {internetResult.download} Mbps
                                </span>
                                <span className={internetResult.upload >= thresholds.minUploadMbps ? "text-green-600" : "text-destructive"}>
                                    ↑ {internetResult.upload} Mbps
                                </span>
                                <span className={internetResult.ping <= thresholds.maxPingMs ? "text-green-600" : "text-destructive"}>
                                    {internetResult.ping} ms latency
                                </span>
                            </div>
                        )}

                        {/* Internet failure explanation — P2 fix */}
                        {key === "internet" && progress.internet === ProctoringState.ERROR && internetResult?.failReason && (
                            <div className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                <span>{internetResult.failReason}</span>
                            </div>
                        )}

                        {/* Microphone failure explanation */}
                        {key === "microphone" && progress.microphone === ProctoringState.ERROR && micError && (
                            <div className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                <span>{micError}</span>
                            </div>
                        )}

                        {/* Microphone failure — generic fallback */}
                        {key === "microphone" && progress.microphone === ProctoringState.ERROR && !micError && (
                            <div className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                <span>Could not access microphone. Check browser permissions and retry.</span>
                            </div>
                        )}

                        {/* Audio output failure explanation */}
                        {key === "audio" && progress.audio === ProctoringState.ERROR && (
                            <div className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                <span>Audio output unavailable. Check that your speakers or headphones are connected.</span>
                            </div>
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
                {hasError && (
                    <Button variant="outline" size="sm" onClick={retryAll}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Retry
                    </Button>
                )}
                <Button
                    size="sm"
                    className="ml-auto"
                    disabled={startDisabled}
                    onClick={onStart}
                >
                    {!sessionReady && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    {startLabel}
                </Button>
            </div>
        </div>
    );
};

export default HardwareCheck;
