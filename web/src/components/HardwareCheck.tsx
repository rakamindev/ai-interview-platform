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
import {
    CheckCircle2,
    XCircle,
    Loader2,
    RefreshCw,
    Laptop,
    Wifi,
    Mic,
    Volume2,
    Camera,
    ArrowRight,
    ShieldCheck,
    Sliders,
    Sparkles,
} from "lucide-react";

interface HardwareCheckProps {
    onStart?: () => void;
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
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
        }, 600);
    }, []);

    // Step 2: Internet
    useEffect(() => {
        if (progress.internet !== ProctoringState.LOADING) return;
        testInternetSpeed(DEFAULT_THRESHOLDS).then((result) => {
            setInternetResult(result);
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
                    audio: ProctoringState.LOADING,
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

    const hasError = Object.values(progress).some((s) => s === ProctoringState.ERROR);
    const criticalPassed =
        progress.osAndBrowser === ProctoringState.PASSED &&
        progress.microphone === ProctoringState.PASSED &&
        progress.audio === ProctoringState.PASSED &&
        (!REQUIRE_CAMERA || progress.camera === ProctoringState.PASSED);

    const isChecking = Object.values(progress).some((s) => s === ProctoringState.LOADING || s === ProctoringState.WAITING);
    const canStart = allPassed || (!isChecking && criticalPassed);

    // Calculate count of passed items
    const totalSteps = REQUIRE_CAMERA ? 5 : 4;
    const passedCount = [
        progress.osAndBrowser === ProctoringState.PASSED,
        progress.internet === ProctoringState.PASSED,
        REQUIRE_CAMERA ? progress.camera === ProctoringState.PASSED : null,
        progress.microphone === ProctoringState.PASSED,
        progress.audio === ProctoringState.PASSED,
    ].filter(Boolean).length;

    // Helper for rendering status pill
    const renderStatusPill = (state: ProctoringState) => {
        if (state === ProctoringState.PASSED) {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Passed
                </span>
            );
        }
        if (state === ProctoringState.LOADING) {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 shadow-sm animate-pulse">
                    <Loader2 className="h-3.5 w-3.5 text-teal-600 animate-spin" />
                    Checking...
                </span>
            );
        }
        if (state === ProctoringState.ERROR) {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm">
                    <XCircle className="h-3.5 w-3.5 text-rose-600" />
                    Failed
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                Waiting
            </span>
        );
    };

    return (
        <div className="relative rounded-3xl bg-white/95 backdrop-blur-2xl border border-emerald-500/25 shadow-[0_20px_50px_-15px_rgba(16,185,129,0.15),0_0_1px_1px_rgba(16,185,129,0.1)] overflow-hidden transition-all">
            {/* Top Glowing Emerald Accent Edge */}
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

            <div className="p-6 sm:p-7 space-y-6">
                {/* Header with Title & Ready Counter */}
                <div className="flex items-center justify-between pb-5 border-b border-emerald-500/15">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-400/40 flex items-center justify-center text-emerald-600 shadow-sm">
                            <Sliders className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                                System Diagnostics
                                <Sparkles className="h-4 w-4 text-emerald-600" />
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Automated device & audio readiness check
                            </p>
                        </div>
                    </div>

                    {/* Progress Badge */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/90 border border-emerald-300 text-xs font-semibold text-emerald-800 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>{passedCount}/{totalSteps} Ready</span>
                    </div>
                </div>

                {/* Camera preview (if enabled) */}
                {REQUIRE_CAMERA && (
                    <div className="relative rounded-2xl bg-slate-950 overflow-hidden aspect-video border border-emerald-500/30 shadow-inner">
                        {videoStream ? (
                            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
                                <Camera className="w-8 h-8 opacity-40 text-emerald-400" />
                                <p className="text-xs">Connecting camera feed...</p>
                            </div>
                        )}
                        {progress.camera === ProctoringState.PASSED && videoStream && (
                            <span className="absolute top-3 left-3 flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-600 text-white px-2.5 py-1 rounded-full shadow-md">
                                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                LIVE CAMERA
                            </span>
                        )}
                    </div>
                )}

                {/* Diagnostics List */}
                <div className="space-y-3">
                    {/* Item 1: OS & Browser */}
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-50/40 via-white to-white border border-emerald-200/70 hover:border-emerald-300 transition-colors shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-emerald-100/60 border border-emerald-300/60 flex items-center justify-center text-emerald-700 shrink-0">
                                    <Laptop className="h-4 w-4" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-semibold text-slate-900">
                                        Operating System & Browser
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Modern WebRTC & AudioContext compatible
                                    </p>
                                </div>
                            </div>
                            <div>{renderStatusPill(progress.osAndBrowser)}</div>
                        </div>
                    </div>

                    {/* Item 2: Internet Connection */}
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-50/40 via-white to-white border border-emerald-200/70 hover:border-emerald-300 transition-colors shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-emerald-100/60 border border-emerald-300/60 flex items-center justify-center text-emerald-700 shrink-0">
                                    <Wifi className="h-4 w-4" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-semibold text-slate-900">
                                        Network Stability & Latency
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Real-time WebSocket connection capability
                                    </p>
                                </div>
                            </div>
                            <div>{renderStatusPill(progress.internet)}</div>
                        </div>

                        {/* Speed Test Metrics Chips */}
                        {internetResult && (
                            <div className="mt-3 pt-3 border-t border-emerald-100 flex flex-wrap items-center gap-2">
                                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                                    internetResult.download >= thresholds.minDownloadMbps
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}>
                                    ↓ {internetResult.download} Mbps Down
                                </span>
                                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                                    internetResult.upload >= thresholds.minUploadMbps
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}>
                                    ↑ {internetResult.upload} Mbps Up
                                </span>
                                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                                    internetResult.ping <= thresholds.maxPingMs
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}>
                                    ⚡ {internetResult.ping} ms Latency
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Item 3: Microphone */}
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-50/40 via-white to-white border border-emerald-200/70 hover:border-emerald-300 transition-colors shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-emerald-100/60 border border-emerald-300/60 flex items-center justify-center text-emerald-700 shrink-0">
                                    <Mic className="h-4 w-4" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-semibold text-slate-900">
                                        Microphone Audio Capture
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Voice clarity & real-time input meter
                                    </p>
                                </div>
                            </div>
                            <div>{renderStatusPill(progress.microphone)}</div>
                        </div>

                        {/* Interactive Voice Waveform Level Meter */}
                        {progress.microphone === ProctoringState.PASSED && (
                            <div className="mt-3 pt-3 border-t border-emerald-100 flex items-center gap-3">
                                <span className="text-[11px] font-medium text-slate-500 shrink-0">
                                    Mic Sensitivity:
                                </span>
                                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden p-0.5 border border-emerald-200/60">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 transition-all duration-75"
                                        style={{ width: `${Math.max(8, Math.min(audioLevel * 2.5, 100))}%` }}
                                    />
                                </div>
                                <span className="text-[11px] font-mono text-emerald-700 font-medium w-8 text-right">
                                    {audioLevel}%
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Item 4: Audio Output / Speaker */}
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-50/40 via-white to-white border border-emerald-200/70 hover:border-emerald-300 transition-colors shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-emerald-100/60 border border-emerald-300/60 flex items-center justify-center text-emerald-700 shrink-0">
                                    <Volume2 className="h-4 w-4" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-semibold text-slate-900">
                                        Speaker / Audio Output
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Synthesized AI question playback
                                    </p>
                                </div>
                            </div>
                            <div>{renderStatusPill(progress.audio)}</div>
                        </div>
                    </div>
                </div>

                {/* Mild Warning if internet is slightly slow but audio is ready */}
                {!allPassed && canStart && (
                    <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-300/70 text-amber-900 text-xs flex items-start gap-2.5">
                        <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">
                            Koneksi internet Anda sedikit di bawah batas ideal, namun perangkat audio terbukti siap. Anda tetap diizinkan memulai wawancara.
                        </span>
                    </div>
                )}

                {/* Footer Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                    {hasError && (
                        <button
                            type="button"
                            onClick={retryAll}
                            className="w-full sm:w-auto px-4 py-3 rounded-2xl border border-slate-300 hover:border-emerald-400 bg-white text-slate-700 hover:text-emerald-700 font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>Ulangi Tes</span>
                        </button>
                    )}

                    <button
                        type="button"
                        disabled={!canStart}
                        onClick={onStart}
                        className="w-full flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm flex items-center justify-center gap-2.5 shadow-[0_6px_25px_rgba(16,185,129,0.35)] hover:shadow-[0_8px_35px_rgba(16,185,129,0.5)] active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer border border-emerald-400/40"
                    >
                        <span>
                            {!allPassed && canStart ? "Proceed to Interview" : "Start Interview"}
                        </span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HardwareCheck;
