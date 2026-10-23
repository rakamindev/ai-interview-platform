import React, { useEffect, useRef, useState } from "react";
import { testInternetSpeed, DEFAULT_THRESHOLDS, formatNumber, type InternetSpeedResult } from "@/utils/internetSpeedTest";
import {
    ProctoringState,
    type HardwareCheckingProgress,
    getBrowserInfo,
    getOSInfo,
    checkCamera,
    getCurrentTime,
} from "@/utils/hardwareUtils";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, XCircle, Loader2, Circle, ShieldCheck, Activity } from "lucide-react";

interface HardwareCheckProps {
    onStart?: () => void;
}

function StateIcon({ state }: { state: ProctoringState }) {
    if (state === ProctoringState.LOADING)
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    if (state === ProctoringState.PASSED)
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    if (state === ProctoringState.ERROR)
        return <XCircle className="h-4 w-4 text-destructive" />;
    return <Circle className="h-4 w-4 text-muted-foreground/30" />;
}

function stateLabel(state: ProctoringState) {
    if (state === ProctoringState.LOADING) return "Memeriksa...";
    if (state === ProctoringState.PASSED) return "Lolos";
    if (state === ProctoringState.ERROR) return "Gagal";
    return "Menunggu";
}

// A null value was not measured (the probe timed out), so it shows as a dash.
function SpeedFigure({ label, unit, value, ok }: { label: string; unit: string; value: number | null; ok: boolean }) {
    return (
        <span className={ok ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-destructive font-medium"}>
            {label}{value === null ? "—" : formatNumber(value)} {unit}
        </span>
    );
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
        } catch { }
    };

    const thresholds = DEFAULT_THRESHOLDS;

    const runChecks = async () => {
        // 1. OS & Browser
        setProgress((prev) => ({ ...prev, osAndBrowser: ProctoringState.LOADING }));
        const os = getOSInfo();
        const browser = getBrowserInfo();
        const osPassed = Boolean(os && os !== "Unknown" && browser && browser.browser !== "Unknown");
        setProgress((prev) => ({
            ...prev,
            osAndBrowser: osPassed ? ProctoringState.PASSED : ProctoringState.ERROR,
        }));

        // 2. Internet Speed (clear the previous result so stale reasons don't sit next to the spinner)
        setInternetResult(null);
        setProgress((prev) => ({ ...prev, internet: ProctoringState.LOADING }));
        const speed = await testInternetSpeed(thresholds);
        setInternetResult(speed);
        setProgress((prev) => ({
            ...prev,
            internet: speed.passed ? ProctoringState.PASSED : ProctoringState.ERROR,
        }));

        // 3. Camera
        if (REQUIRE_CAMERA) {
            setProgress((prev) => ({ ...prev, camera: ProctoringState.LOADING }));
            const camPassed = await checkCamera();
            if (camPassed) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    setVideoStream(stream);
                } catch { }
            }
            setProgress((prev) => ({
                ...prev,
                camera: camPassed ? ProctoringState.PASSED : ProctoringState.ERROR,
            }));
        } else {
            setProgress((prev) => ({ ...prev, camera: ProctoringState.PASSED }));
        }

        // 4. Microphone
        setProgress((prev) => ({ ...prev, microphone: ProctoringState.LOADING }));
        try {
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            startAudioLevelMonitoring(micStream);
            setProgress((prev) => ({ ...prev, microphone: ProctoringState.PASSED }));
        } catch {
            setProgress((prev) => ({ ...prev, microphone: ProctoringState.ERROR }));
        }

        // 5. Audio Output
        setProgress((prev) => ({ ...prev, audio: ProctoringState.LOADING }));
        const audioPassed = await checkAudioPlayback();
        setProgress((prev) => ({
            ...prev,
            audio: audioPassed ? ProctoringState.PASSED : ProctoringState.ERROR,
        }));
    };

    useEffect(() => {
        runChecks();
    }, []);

    const retryAll = () => {
        setProgress({
            osAndBrowser: ProctoringState.WAITING,
            internet: ProctoringState.WAITING,
            camera: ProctoringState.WAITING,
            audio: ProctoringState.WAITING,
            microphone: ProctoringState.WAITING,
        });
        runChecks();
    };

    const rows: { key: keyof HardwareCheckingProgress; label: string; desc: string }[] = [
        { key: "osAndBrowser", label: "Sistem Operasi & Browser", desc: "Verifikasi kompatibilitas web platform" },
        { key: "internet", label: "Koneksi Jaringan Internet", desc: "Unduh, unggah & latensi ke server wawancara" },
        ...(REQUIRE_CAMERA ? [{ key: "camera" as const, label: "Kamera Video", desc: "Uji akses video stream" }] : []),
        { key: "microphone", label: "Mikrofon / Input Suara", desc: "Uji tangkapan gelombang suara mikrofon" },
        { key: "audio", label: "Speaker / Output Audio", desc: "Uji pemutaran suara asisten AI" },
    ];

    const hasError = Object.values(progress).some((s) => s === ProctoringState.ERROR);

    return (
        <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
            {/* Checklist */}
            <div className="divide-y divide-border/60">
                {rows.map(({ key, label, desc }) => (
                    <div key={key} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <span className="text-sm font-semibold text-foreground">{label}</span>
                            <p className="text-[11px] text-muted-foreground">{desc}</p>

                            {/* Internet speed details */}
                            {key === "internet" && internetResult && !internetResult.error && (
                                <div className="mt-1.5 flex gap-3 text-xs">
                                    <SpeedFigure
                                        label="↓ "
                                        unit="Mbps"
                                        value={internetResult.download}
                                        ok={internetResult.download !== null && internetResult.download >= thresholds.minDownloadMbps}
                                    />
                                    <SpeedFigure
                                        label="↑ "
                                        unit="Mbps"
                                        value={internetResult.upload}
                                        ok={internetResult.upload !== null && internetResult.upload >= thresholds.minUploadMbps}
                                    />
                                    <SpeedFigure
                                        label=""
                                        unit="ms"
                                        value={internetResult.ping}
                                        ok={internetResult.ping !== null && internetResult.ping <= thresholds.maxPingMs}
                                    />
                                </div>
                            )}

                            {/* Why the internet check failed, so the candidate knows what to fix */}
                            {key === "internet" && internetResult && !internetResult.passed && (
                                <ul className="mt-1 text-[11px] text-destructive space-y-0.5">
                                    {(internetResult.error ? [internetResult.error] : internetResult.failures).map((reason) => (
                                        <li key={reason}>{reason}</li>
                                    ))}
                                </ul>
                            )}

                            {/* Mic level bar */}
                            {key === "microphone" && progress.microphone === ProctoringState.PASSED && (
                                <div className="mt-2 flex items-center gap-2 max-w-xs">
                                    <Activity className="h-3.5 w-3.5 text-primary" />
                                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden border border-border/50">
                                        <div
                                            className="h-full bg-primary transition-all duration-150"
                                            style={{ width: `${Math.min(audioLevel * 3, 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{audioLevel}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                            <StateIcon state={progress[key]} />
                            <span className={`text-xs font-semibold w-20 text-right ${progress[key] === ProctoringState.PASSED ? "text-emerald-600 dark:text-emerald-400" :
                                progress[key] === ProctoringState.ERROR ? "text-destructive" :
                                    "text-muted-foreground"
                                }`}>
                                {stateLabel(progress[key])}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-border/80 flex items-center justify-between gap-3 bg-muted/30">
                {hasError ? (
                    <Button variant="outline" size="sm" onClick={retryAll} className="rounded-xl border-border">
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Uji Ulang
                    </Button>
                ) : (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <span>Sistem siap merekam audio sesi secara aman</span>
                    </div>
                )}
                <Button
                    size="sm"
                    className="ml-auto rounded-xl bg-primary text-primary-foreground font-semibold px-5 shadow-sm"
                    disabled={!allPassed}
                    onClick={onStart}
                >
                    Mulai Wawancara
                </Button>
            </div>
        </div>
    );
};

export default HardwareCheck;
