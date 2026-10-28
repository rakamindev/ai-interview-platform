import React, { useEffect, useRef, useState } from "react";
import { testInternetSpeed, DEFAULT_THRESHOLDS, type InternetSpeedResult } from "@/utils/internetSpeedTest";
import {
    ProctoringState,
    type HardwareCheckingProgress,
    checkCamera,
} from "@/utils/hardwareUtils";
import { Button } from "@/components/ui/button";
import {
    RefreshCw,
    CheckCircle2,
    XCircle,
    Loader2,
    Circle,
    Mic,
    Volume2,
    Wifi,
    Monitor,
    Camera,
    ArrowDown,
    ArrowUp,
} from "lucide-react";
import AudioDecibelMeter from "@/components/interview/atoms/AudioDecibelMeter";

interface HardwareCheckProps {
    onStart?: () => void;
}

function StateIcon({ state }: { state: ProctoringState }) {
    if (state === ProctoringState.LOADING)
        return <Loader2 className="h-4 w-4 animate-spin text-neutral-500" data-testid="icon-loading" />;
    if (state === ProctoringState.PASSED)
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" data-testid="icon-passed" />;
    if (state === ProctoringState.ERROR)
        return <XCircle className="h-4 w-4 text-rose-600" data-testid="icon-error" />;
    return <Circle className="h-4 w-4 text-neutral-300" data-testid="icon-waiting" />;
}

function stateLabel(state: ProctoringState) {
    if (state === ProctoringState.LOADING) return "Memeriksa...";
    if (state === ProctoringState.PASSED) return "Lolos";
    if (state === ProctoringState.ERROR) return "Gagal";
    return "Menunggu";
}

function createSafeAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if ("AudioContext" in window && window.AudioContext) {
        return new window.AudioContext();
    }
    const win = window as unknown as Record<string, unknown>;
    const webkitCtx = win["webkitAudioContext"];
    if (typeof webkitCtx === "function") {
        const Ctor = webkitCtx as unknown as typeof AudioContext;
        return new Ctor();
    }
    return null;
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
    const [playingSound, setPlayingSound] = useState(false);
    const [soundPlayed, setSoundPlayed] = useState(false);
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

    const playTestChime = async (): Promise<boolean> => {
        setPlayingSound(true);
        try {
            const ctx = createSafeAudioContext();
            if (!ctx) {
                setPlayingSound(false);
                return false;
            }
            if (ctx.state === "suspended") await ctx.resume();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            gain.gain.setValueAtTime(0.001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.4);
            setTimeout(() => {
                setPlayingSound(false);
                setSoundPlayed(true);
            }, 450);
            return true;
        } catch {
            setPlayingSound(false);
            return false;
        }
    };

    const checkAudioPlayback = async (): Promise<boolean> => {
        try {
            const ctx = createSafeAudioContext();
            if (!ctx) return false;
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
            const ctx = createSafeAudioContext();
            if (!ctx) return;
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
        const t = setTimeout(() => {
            setProgress((p) => ({
                ...p,
                osAndBrowser: ProctoringState.PASSED,
                internet: ProctoringState.LOADING,
            }));
        }, 300);
        return () => clearTimeout(t);
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

    const rows: {
        key: keyof HardwareCheckingProgress;
        label: string;
        icon: React.ReactNode;
    }[] = [
        {
            key: "osAndBrowser",
            label: "Sistem Operasi & Browser",
            icon: <Monitor className="h-4 w-4 text-neutral-500" />,
        },
        {
            key: "internet",
            label: "Koneksi Internet",
            icon: <Wifi className="h-4 w-4 text-neutral-500" />,
        },
        ...(REQUIRE_CAMERA
            ? [{
                key: "camera" as const,
                label: "Kamera Web",
                icon: <Camera className="h-4 w-4 text-neutral-500" />,
            }]
            : []),
        {
            key: "microphone",
            label: "Mikrofon Input",
            icon: <Mic className="h-4 w-4 text-neutral-500" />,
        },
        {
            key: "audio",
            label: "Speaker / Audio Output",
            icon: <Volume2 className="h-4 w-4 text-neutral-500" />,
        },
    ];

    const hasError = Object.values(progress).some((s) => s === ProctoringState.ERROR);

    return (
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm" data-testid="hardware-check-card">
            {/* Camera preview */}
            {REQUIRE_CAMERA && (
                <div className="relative bg-neutral-900 aspect-video">
                    {videoStream ? (
                        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400 gap-2">
                            <Camera className="w-10 h-10 opacity-30" />
                            <p className="text-xs">Kamera tidak aktif</p>
                        </div>
                    )}
                    {progress.camera === ProctoringState.PASSED && videoStream && (
                        <span className="absolute bottom-2 left-2 flex items-center gap-1.5 text-xs bg-rose-600 text-white px-2.5 py-0.5 rounded-full font-medium shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            LIVE
                        </span>
                    )}
                </div>
            )}

            {/* Checklist */}
            <div className="divide-y divide-neutral-100">
                {rows.map(({ key, label, icon }) => (
                    <div key={key} className="px-5 py-3.5 hover:bg-neutral-50/50 transition-colors">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                {icon}
                                <span className="text-sm font-medium text-neutral-800">{label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <StateIcon state={progress[key]} />
                                <span className={`text-xs w-20 text-right font-medium ${
                                    progress[key] === ProctoringState.PASSED
                                        ? "text-emerald-600"
                                        : progress[key] === ProctoringState.ERROR
                                        ? "text-rose-600"
                                        : "text-neutral-400"
                                }`}>
                                    {stateLabel(progress[key])}
                                </span>
                            </div>
                        </div>

                        {/* Internet speed details */}
                        {key === "internet" && internetResult && (
                            <div className="mt-2.5 flex items-center gap-4 text-xs font-mono">
                                <span className={`flex items-center ${
                                    internetResult.download >= thresholds.minDownloadMbps ? "text-emerald-600" : "text-rose-600"
                                }`}>
                                    <ArrowDown className="h-3 w-3 mr-0.5 shrink-0" />
                                    {internetResult.download} Mbps
                                </span>
                                <span className={`flex items-center ${
                                    internetResult.upload >= thresholds.minUploadMbps ? "text-emerald-600" : "text-rose-600"
                                }`}>
                                    <ArrowUp className="h-3 w-3 mr-0.5 shrink-0" />
                                    {internetResult.upload} Mbps
                                </span>
                                <span className={
                                    internetResult.ping <= thresholds.maxPingMs ? "text-emerald-600" : "text-rose-600"
                                }>
                                    {internetResult.ping} ms
                                </span>
                            </div>
                        )}

                        {/* Mic level bar */}
                        {key === "microphone" && progress.microphone === ProctoringState.PASSED && (
                            <div className="mt-2.5 pt-1">
                                <AudioDecibelMeter
                                    level={Math.min(audioLevel * 2, 100)}
                                    label="Bicaralah untuk melihat sinyal input mikrofon"
                                    className="items-start"
                                />
                            </div>
                        )}

                        {/* Speaker Play Sound Chime */}
                        {key === "audio" && progress.audio === ProctoringState.PASSED && (
                            <div className="mt-2.5 flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={playTestChime}
                                    disabled={playingSound}
                                    className="h-7 px-2.5 text-xs gap-1.5 text-neutral-700 bg-neutral-50 hover:bg-neutral-100"
                                    data-testid="play-test-chime-btn"
                                >
                                    <Volume2 className="h-3 w-3 text-neutral-500" />
                                    {playingSound
                                        ? "Memutar nada 440Hz..."
                                        : soundPlayed
                                        ? "Putar Ulang Suara Uji"
                                        : "Putar Suara Uji (Chime)"}
                                </Button>
                                {soundPlayed && (
                                    <span className="text-xs text-emerald-600 flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Suara terkonfirmasi
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-neutral-100 flex items-center justify-between gap-3 bg-neutral-50/80">
                {hasError && (
                    <Button variant="outline" size="sm" onClick={retryAll} className="text-xs h-8">
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Coba Lagi
                    </Button>
                )}
                <Button
                    size="sm"
                    className="ml-auto text-xs h-8 bg-neutral-900 hover:bg-neutral-800 text-white font-medium px-4"
                    disabled={!allPassed}
                    onClick={onStart}
                    data-testid="hardware-start-btn"
                >
                    Mulai Wawancara
                </Button>
            </div>
        </div>
    );
};

export default HardwareCheck;
