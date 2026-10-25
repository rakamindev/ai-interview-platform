import React, { useEffect, useRef, useState, useCallback } from "react";
import { testInternetSpeed, DEFAULT_THRESHOLDS, type InternetSpeedResult } from "../utils/internetSpeedTest";
import {
    ProctoringState,
    type HardwareCheckingProgress,
    getBrowserInfo,
    getOSInfo,
    checkCamera,
    getCurrentTime,
} from "../utils/hardwareUtils";
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

    const [internetResult, setInternetResult] = useState<InternetSpeedResult | null>(null);
    const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
    const [audioLevel, setAudioLevel] = useState<number>(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const animFrameRef = useRef<number | null>(null);

    // Audio Output Playback Verification
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
        } catch {
            return false;
        }
    };

    // Microphone Level Monitoring
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
                const avg = Math.round(data.reduce((a, b) => a + b, 0) / data.length);
                setAudioLevel(avg);
                animFrameRef.current = requestAnimationFrame(update);
            };
            update();
        } catch {
            /* silent */
        }
    };

    const stopMonitoringAndTracks = useCallback(() => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }
        setVideoStream(null);
    }, []);

    // Full Systematic Hardware Verification Runner
    const runHardwareChecks = useCallback(async () => {
        stopMonitoringAndTracks();
        setInternetResult(null);

        // Step 1: OS & Browser Check
        setProgress({
            osAndBrowser: ProctoringState.LOADING,
            internet: ProctoringState.WAITING,
            camera: ProctoringState.WAITING,
            microphone: ProctoringState.WAITING,
            audio: ProctoringState.WAITING,
        });

        await new Promise((r) => setTimeout(r, 600));
        getBrowserInfo();
        getOSInfo();
        getCurrentTime();
        setProgress((prev) => ({
            ...prev,
            osAndBrowser: ProctoringState.PASSED,
            internet: ProctoringState.LOADING,
        }));

        // Step 2: Internet Speed Check
        const speedRes = await testInternetSpeed(DEFAULT_THRESHOLDS);
        setInternetResult(speedRes);

        // Step 3: Camera / Microphone (ALWAYS runs, even if internet was suboptimal!)
        setProgress((prev) => ({
            ...prev,
            internet: speedRes.passed ? ProctoringState.PASSED : ProctoringState.ERROR,
            ...(REQUIRE_CAMERA
                ? { camera: ProctoringState.LOADING }
                : { camera: ProctoringState.PASSED, microphone: ProctoringState.LOADING }),
        }));

        if (REQUIRE_CAMERA) {
            const camStream = await checkCamera();
            if (camStream) {
                mediaStreamRef.current = camStream;
                setVideoStream(camStream);
                startAudioLevelMonitoring(camStream);
                setProgress((prev) => ({
                    ...prev,
                    camera: ProctoringState.PASSED,
                    microphone: ProctoringState.PASSED,
                    audio: ProctoringState.LOADING,
                }));
            } else {
                setProgress((prev) => ({
                    ...prev,
                    camera: ProctoringState.ERROR,
                    microphone: ProctoringState.ERROR,
                    audio: ProctoringState.LOADING,
                }));
            }
        } else {
            try {
                const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaStreamRef.current = micStream;
                startAudioLevelMonitoring(micStream);
                setProgress((prev) => ({
                    ...prev,
                    camera: ProctoringState.PASSED,
                    microphone: ProctoringState.PASSED,
                    audio: ProctoringState.LOADING,
                }));
            } catch {
                setProgress((prev) => ({
                    ...prev,
                    camera: ProctoringState.PASSED,
                    microphone: ProctoringState.ERROR,
                    audio: ProctoringState.LOADING,
                }));
            }
        }

        // Step 4: Audio Output Verification
        const audioOk = await checkAudioPlayback();
        setProgress((prev) => ({
            ...prev,
            audio: audioOk ? ProctoringState.PASSED : ProctoringState.ERROR,
        }));
    }, [stopMonitoringAndTracks]);

    // Initial mount execution
    useEffect(() => {
        runHardwareChecks();
        return () => {
            stopMonitoringAndTracks();
        };
    }, [runHardwareChecks, stopMonitoringAndTracks]);

    // Update video element reference when video stream changes
    useEffect(() => {
        if (videoRef.current && videoStream) {
            videoRef.current.srcObject = videoStream;
        }
    }, [videoStream]);

    const thresholds = DEFAULT_THRESHOLDS;

    const rows: { key: keyof HardwareCheckingProgress; label: string }[] = [
        { key: "osAndBrowser", label: "OS & browser" },
        { key: "internet", label: "Internet" },
        ...(REQUIRE_CAMERA ? [{ key: "camera" as const, label: "Camera" }] : []),
        { key: "microphone", label: "Microphone" },
        { key: "audio", label: "Audio output" },
    ];

    const hasError = Object.values(progress).some((s) => s === ProctoringState.ERROR);

    // Essential voice hardware verification
    const voiceHardwarePassed =
        progress.osAndBrowser === ProctoringState.PASSED &&
        progress.microphone === ProctoringState.PASSED &&
        progress.audio === ProctoringState.PASSED &&
        (!REQUIRE_CAMERA || progress.camera === ProctoringState.PASSED);

    const allPassed = voiceHardwarePassed && progress.internet === ProctoringState.PASSED;
    const canProceedWithWarning = voiceHardwarePassed && progress.internet === ProctoringState.ERROR;

    return (
        <div className="rounded-lg border bg-card overflow-hidden shadow-xs">
            {/* Camera preview (if proctoring enabled) */}
            {REQUIRE_CAMERA && (
                <div className="relative bg-black aspect-video">
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
                        <span className="absolute bottom-2 left-2 flex items-center gap-1 text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            LIVE
                        </span>
                    )}
                </div>
            )}

            {/* Checklist */}
            <div className="divide-y divide-border">
                {rows.map(({ key, label }) => (
                    <div key={key} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">{label}</span>
                            <div className="flex items-center gap-2">
                                <StateIcon state={progress[key]} />
                                <span
                                    className={`text-xs w-16 text-right font-medium ${
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

                        {/* Internet speed details */}
                        {key === "internet" && internetResult && (
                            <div className="mt-2 flex flex-wrap gap-3 text-xs">
                                <span
                                    className={
                                        internetResult.download >= thresholds.minDownloadMbps
                                            ? "text-green-600 font-medium"
                                            : "text-destructive font-medium"
                                    }
                                >
                                    ↓ {internetResult.download} Mbps
                                </span>
                                <span
                                    className={
                                        internetResult.upload >= thresholds.minUploadMbps
                                            ? "text-green-600 font-medium"
                                            : "text-destructive font-medium"
                                    }
                                >
                                    ↑ {internetResult.upload} Mbps
                                </span>
                                <span
                                    className={
                                        internetResult.ping <= thresholds.maxPingMs
                                            ? "text-green-600 font-medium"
                                            : "text-destructive font-medium"
                                    }
                                >
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
                                <span className="text-xs text-muted-foreground w-8 text-right font-mono">{audioLevel}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Sub-optimal internet notice */}
            {canProceedWithWarning && (
                <div className="px-4 py-2.5 bg-amber-500/10 border-t border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>Your connection is slower than recommended, but microphone and speakers are verified. You can retry or proceed.</span>
                </div>
            )}

            {/* Footer */}
            <div className="px-4 py-3 border-t flex items-center justify-between gap-3 bg-muted/30">
                {hasError && (
                    <Button variant="outline" size="sm" onClick={runHardwareChecks}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Retry
                    </Button>
                )}
                <div className="ml-auto flex items-center gap-2">
                    {canProceedWithWarning && !allPassed && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-amber-500/40 text-amber-700 hover:bg-amber-50 dark:text-amber-400"
                            onClick={() => {
                                stopMonitoringAndTracks();
                                onStart?.();
                            }}
                        >
                            Proceed Anyway
                        </Button>
                    )}
                    <Button
                        size="sm"
                        disabled={!allPassed}
                        onClick={() => {
                            stopMonitoringAndTracks();
                            onStart?.();
                        }}
                    >
                        Start Interview
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default HardwareCheck;
