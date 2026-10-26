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

function formatDuration(milliseconds: number) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

// Camera is a hard requirement, like the microphone; only a deployment-level env flag may disable it.
const REQUIRE_CAMERA = import.meta.env.VITE_REQUIRE_CAMERA !== "false";

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
    const [trialPassed, setTrialPassed] = useState(false);
    const [trialRecording, setTrialRecording] = useState(false);
    const [trialElapsedMs, setTrialElapsedMs] = useState(0);
    const [trialError, setTrialError] = useState<string | null>(null);
    const [trialUrl, setTrialUrl] = useState<string | null>(null);
    const [trialUnsupported, setTrialUnsupported] = useState(false);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const trialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const trialIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const trialOwnsStreamRef = useRef(false);
    const trialStartedAtRef = useRef<number | null>(null);
    const chunksRef = useRef<BlobPart[]>([]);
    const videoRef = useRef<HTMLVideoElement>(null);
    const cameraRequired = REQUIRE_CAMERA;


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

    useEffect(() => {
        return () => {
            if (trialUrl) URL.revokeObjectURL(trialUrl);
            if (trialTimerRef.current) clearTimeout(trialTimerRef.current);
            if (trialIntervalRef.current) clearInterval(trialIntervalRef.current);
            if (recorderRef.current?.state === "recording") recorderRef.current.stop();
        };
    }, [trialUrl]);

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

    const stopTrialRecording = () => {
        if (trialTimerRef.current) {
            clearTimeout(trialTimerRef.current);
            trialTimerRef.current = null;
        }
        if (trialIntervalRef.current) {
            clearInterval(trialIntervalRef.current);
            trialIntervalRef.current = null;
        }
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    };

    // F-21: Record up to one minute; candidate can stop early.
    const startTrialRecording = async () => {
        setTrialError(null);
        setTrialUrl(null);
        setTrialElapsedMs(0);
        trialStartedAtRef.current = null;
        chunksRef.current = [];
        try {
            const stream = videoStream ?? await navigator.mediaDevices.getUserMedia({ audio: true });
            trialOwnsStreamRef.current = !videoStream;
            if (typeof MediaRecorder === "undefined") throw new Error("MediaRecorder is unavailable");
            const recorder = new MediaRecorder(stream);
            recorderRef.current = recorder;
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            recorder.onstop = () => {
                if (trialStartedAtRef.current !== null) setTrialElapsedMs(Date.now() - trialStartedAtRef.current);
                if (trialIntervalRef.current) clearInterval(trialIntervalRef.current);
                trialIntervalRef.current = null;
                if (trialOwnsStreamRef.current) stream.getTracks().forEach((track) => track.stop());
                trialOwnsStreamRef.current = false;
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType || (cameraRequired ? "video/webm" : "audio/webm") });
                if (blob.size < 100) {
                    setTrialError("Recording was empty. Please check your microphone and try again.");
                    setTrialRecording(false);
                    return;
                }
                setTrialUrl(URL.createObjectURL(blob));
                setTrialRecording(false);
            };
            recorder.onerror = () => {
                if (trialIntervalRef.current) clearInterval(trialIntervalRef.current);
                trialIntervalRef.current = null;
                if (trialOwnsStreamRef.current) stream.getTracks().forEach((track) => track.stop());
                trialOwnsStreamRef.current = false;
                setTrialError("Recording failed. Your browser may not support MediaRecorder. Please try again.");
                setTrialRecording(false);
            };
            trialStartedAtRef.current = Date.now();
            setTrialElapsedMs(0);
            recorder.start();
            setTrialRecording(true);
            trialIntervalRef.current = setInterval(() => {
                if (trialStartedAtRef.current !== null) setTrialElapsedMs(Date.now() - trialStartedAtRef.current);
            }, 250);
            trialTimerRef.current = setTimeout(stopTrialRecording, 60_000);
        } catch {
            if (typeof MediaRecorder === "undefined") {
                setTrialUnsupported(true);
                setTrialError("This browser cannot record, so the trial recording is skipped. Your microphone and camera checks above are still required.");
            } else {
                setTrialError("Could not access microphone for trial recording. Please check permissions and try again.");
            }
            setTrialRecording(false);
        }
    };

    const retryTrial = () => {
        if (trialUrl) { URL.revokeObjectURL(trialUrl); }
        setTrialUrl(null);
        setTrialPassed(false);
        setTrialError(null);
        setTrialUnsupported(false);
    };

    const confirmTrial = () => {
        setTrialPassed(true);
        if (trialUrl) { URL.revokeObjectURL(trialUrl); setTrialUrl(null); }
    };

    const skipTrial = () => {
        setTrialPassed(true);
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
                    ? cameraRequired
                        ? { camera: ProctoringState.LOADING }
                        : { camera: ProctoringState.PASSED, microphone: ProctoringState.LOADING }
                    : {}),
            }));
        });
    }, [progress.internet]);

    // Step 3: Camera + microphone (or microphone-only when camera disabled)
    useEffect(() => {
        const cameraLoading = progress.camera === ProctoringState.LOADING;
        const micLoading = !cameraRequired && progress.microphone === ProctoringState.LOADING;
        if (!cameraLoading && !micLoading) return;

        const getStream = cameraRequired
            ? checkCamera()
            : navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);

        getStream.then((stream) => {
            if (stream) {
                if (cameraRequired) setVideoStream(stream);
                startAudioLevelMonitoring(stream);
                setProgress((p) => ({
                    ...p,
                    ...(cameraRequired ? { camera: ProctoringState.PASSED } : {}),
                    microphone: ProctoringState.PASSED,
                    audio: ProctoringState.LOADING,
                }));
            } else {
                setProgress((p) => ({
                    ...p,
                    ...(cameraRequired ? { camera: ProctoringState.ERROR } : {}),
                    microphone: ProctoringState.ERROR,
                }));
            }
        });
    }, [progress.camera, progress.microphone, cameraRequired]);

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
        if (trialUrl) URL.revokeObjectURL(trialUrl);
        setTrialUrl(null);
        setTrialPassed(false);
        setTrialError(null);
        setTrialUnsupported(false);
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
        ...(cameraRequired ? [{ key: "camera" as const, label: "Camera" }] : []),
        { key: "microphone", label: "Microphone" },
        { key: "audio", label: "Audio output" },
    ];

    const hasError = Object.values(progress).some((s) => s === ProctoringState.ERROR);

    return (
        <div className="rounded-lg border bg-card overflow-hidden">
            {/* Camera preview */}
            {cameraRequired && <div className="relative bg-black aspect-video">
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
                                <span className={`text-xs w-16 text-right ${progress[key] === ProctoringState.PASSED ? "text-green-600" :
                                    progress[key] === ProctoringState.ERROR ? "text-destructive" :
                                        "text-muted-foreground"
                                    }`}>
                                    {stateLabel(progress[key])}
                                </span>
                            </div>
                        </div>

                        {/* Internet speed details */}
                        {key === "internet" && internetResult && (
                            <div className="mt-2 flex gap-3 text-xs">
                                <span className={internetResult.download >= thresholds.minDownloadMbps ? "text-green-600" : "text-destructive"}>
                                    ↓ {internetResult.download} Mbps
                                </span>
                                <span className={internetResult.upload >= thresholds.minUploadMbps ? "text-green-600" : "text-destructive"}>
                                    ↑ {internetResult.upload} Mbps
                                </span>
                                <span className={internetResult.ping <= thresholds.maxPingMs ? "text-green-600" : "text-destructive"}>
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

            {/* Camera is a hard requirement: no interview without an active camera. */}
            {progress.camera === ProctoringState.ERROR && (
                <div className="px-4 py-3 bg-amber-50 border-t">
                    <p className="text-sm text-amber-800">
                        Camera is required. The interview cannot start without an active camera. Please allow camera access or use a device with a camera.
                    </p>
                </div>
            )}

            {/* F-21: Trial recording section */}
            {allPassed && !trialPassed && (
                <div className="px-4 py-3 border-t space-y-3">
                    <p className="text-sm font-medium">Trial Recording</p>
                    <p className="text-xs text-muted-foreground">
                        Record up to 1 minute, then play it back to check your camera and microphone. You can stop the recording anytime. It stays on your device and is not uploaded.
                    </p>
                    {trialError && (
                        <p className="text-xs text-destructive">{trialError}</p>
                    )}
                    {!trialUrl && !trialRecording && !trialUnsupported && (
                        <Button size="sm" onClick={startTrialRecording}>
                            🎙 Record Trial
                        </Button>
                    )}
                    {trialUnsupported && !trialPassed && !trialRecording && (
                        <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                                Trial skipped: this browser cannot record. Your microphone and camera checks above still apply.
                            </p>
                            <Button size="sm" onClick={skipTrial}>
                                Continue without trial recording
                            </Button>
                        </div>
                    )}
                    {trialRecording && (
                        <div className="flex items-center gap-3">
                            <p className="text-sm font-mono tabular-nums" aria-live="off">
                                Recording {formatDuration(trialElapsedMs)} / 01:00
                            </p>
                            <Button size="sm" variant="outline" onClick={stopTrialRecording}>Stop recording</Button>
                        </div>
                    )}
                    {trialUrl && (
                        <div className="space-y-2">
                            {cameraRequired ? (
                                <video controls src={trialUrl} className="w-full aspect-video rounded-md bg-black" />
                            ) : (
                                <audio controls src={trialUrl} className="w-full" />
                            )}
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={retryTrial}>
                                    Try again
                                </Button>
                                <Button size="sm" onClick={confirmTrial}>
                                    Sounds good — continue
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
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
                    disabled={!allPassed || !trialPassed}
                    onClick={onStart}
                >
                    Start Interview
                </Button>
            </div>
        </div>
    );
};

export default HardwareCheck;
