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
    // Anything else that must be ready before Start (the camera and screen share, when the assessment requires them).
    extraReady?: boolean;
}

function StateIcon({ state }: Readonly<{ state: ProctoringState }>) {
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

function stateColor(state: ProctoringState) {
    if (state === ProctoringState.PASSED) return "text-green-700";
    if (state === ProctoringState.ERROR) return "text-destructive";
    return "text-muted-foreground";
}

const REQUIRE_CAMERA = import.meta.env.VITE_REQUIRE_CAMERA === "true";

/** The camera and mic together when the camera is required, otherwise the mic alone; null when refused or missing. */
async function requestCheckStream(): Promise<MediaStream | null> {
    if (REQUIRE_CAMERA) return checkCamera();
    // No mediaDevices on a page served over plain http: report the mic as failed rather than throw.
    if (!navigator.mediaDevices?.getUserMedia) return null;
    try {
        return await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
        return null;
    }
}

const HardwareCheck: React.FC<Readonly<HardwareCheckProps>> = ({ onStart, extraReady = true }) => {
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
    // Each run of the checks has a number; Retry starts a new one, and results from an older run are ignored (P2-23).
    const [runId, setRunId] = useState(0);
    const runRef = useRef(0);
    // What the mic check opened, so it's all stopped when the check goes away or reruns (P2-24).
    const micStreamRef = useRef<MediaStream | null>(null);
    const meterCtxRef = useRef<AudioContext | null>(null);
    const meterFrameRef = useRef<number | null>(null);

    const stopMeter = () => {
        if (meterFrameRef.current !== null) cancelAnimationFrame(meterFrameRef.current);
        meterFrameRef.current = null;
        meterCtxRef.current?.close?.()?.catch(() => {});
        meterCtxRef.current = null;
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
    };

    useEffect(() => stopMeter, []);

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
            setTimeout(() => ctx.close?.()?.catch(() => {}), 300);
            return true;
        } catch { return false; }
    };

    const startAudioLevelMonitoring = (stream: MediaStream) => {
        stopMeter();
        micStreamRef.current = REQUIRE_CAMERA ? null : stream; // with the camera, videoStream owns the tracks
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioCtx();
            meterCtxRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            const update = () => {
                analyser.getByteFrequencyData(data);
                setAudioLevel(Math.round(data.reduce((a, b) => a + b, 0) / data.length));
                meterFrameRef.current = requestAnimationFrame(update);
            };
            update();
        } catch { /* silent */ }
    };

    // Step 1: OS & browser (again on every Retry)
    useEffect(() => {
        runRef.current = runId;
        setProgress((p) => ({ ...p, osAndBrowser: ProctoringState.LOADING }));
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
    }, [runId]);

    // Step 2: Internet
    useEffect(() => {
        if (progress.internet !== ProctoringState.LOADING) return;
        const run = runRef.current;
        void testInternetSpeed(DEFAULT_THRESHOLDS).then((result) => {
            if (run !== runRef.current) return;
            setInternetResult(result);
            // The device checks go on either way, so a candidate whose connection fails still learns whether their
            // mic and speakers work (P2-21). Start still needs every row to pass.
            setProgress((p) => ({
                ...p,
                internet: result.passed ? ProctoringState.PASSED : ProctoringState.ERROR,
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

        const run = runRef.current;
        void requestCheckStream().then((stream) => {
            if (run !== runRef.current) {
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
                // Playing a tone doesn't need the mic, so audio output is still checked.
                setProgress((p) => ({
                    ...p,
                    ...(REQUIRE_CAMERA ? { camera: ProctoringState.ERROR } : {}),
                    microphone: ProctoringState.ERROR,
                    audio: ProctoringState.LOADING,
                }));
            }
        });
    }, [progress.camera, progress.microphone]);

    // Step 4: Audio output
    useEffect(() => {
        if (progress.audio !== ProctoringState.LOADING) return;
        void checkAudioPlayback().then((ok) => {
            setProgress((p) => ({
                ...p,
                audio: ok ? ProctoringState.PASSED : ProctoringState.ERROR,
            }));
        });
    }, [progress.audio]);

    const retryAll = () => {
        stopMeter();
        setAudioLevel(0);
        videoStream?.getTracks().forEach((t) => t.stop());
        setVideoStream(null);
        setInternetResult(null);
        setProgress({
            osAndBrowser: ProctoringState.WAITING,
            internet: ProctoringState.WAITING,
            camera: ProctoringState.WAITING,
            audio: ProctoringState.WAITING,
            microphone: ProctoringState.WAITING,
        });
        setRunId((id) => id + 1);
    };

    const thresholds = DEFAULT_THRESHOLDS;

    const rows: { key: keyof HardwareCheckingProgress; label: string }[] = [
        { key: "osAndBrowser", label: "OS & browser" },
        { key: "internet", label: "Internet" },
        ...(REQUIRE_CAMERA ? [{ key: "camera" as const, label: "Camera" }] : []),
        { key: "microphone", label: "Microphone" },
        { key: "audio", label: "Audio output" },
    ];

    const hasError = Object.values(progress).includes(ProctoringState.ERROR);

    return (
        <div className="rounded-lg border bg-card overflow-hidden">
            {/* Camera preview */}
            {REQUIRE_CAMERA && <div className="relative bg-black aspect-video">
                {videoStream ? (
                    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
                        <svg aria-hidden="true" className="w-10 h-10 opacity-30" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xs">Camera not active</p>
                    </div>
                )}
                {progress.camera === ProctoringState.PASSED && videoStream && (
                    <span className="absolute bottom-2 left-2 flex items-center gap-1 text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        {"LIVE"}
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
                                <span className={`text-xs w-16 text-right ${stateColor(progress[key])}`}>
                                    {stateLabel(progress[key])}
                                </span>
                            </div>
                        </div>

                        {/* Internet speed details */}
                        {key === "internet" && internetResult && (
                            <div className="mt-2 flex gap-3 text-xs">
                                <span className={internetResult.download >= thresholds.minDownloadMbps ? "text-green-700" : "text-destructive"}>
                                    ↓ {internetResult.download} Mbps
                                </span>
                                <span className={internetResult.upload >= thresholds.minUploadMbps ? "text-green-700" : "text-destructive"}>
                                    ↑ {internetResult.upload} Mbps
                                </span>
                                <span className={internetResult.ping <= thresholds.maxPingMs ? "text-green-700" : "text-destructive"}>
                                    {internetResult.ping} ms
                                </span>
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
                    disabled={!allPassed || !extraReady}
                    onClick={onStart}
                >
                    Start Interview
                </Button>
            </div>
        </div>
    );
};

export default HardwareCheck;
