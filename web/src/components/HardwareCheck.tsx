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
import { RefreshCw, Loader2, Check, X, AlertCircle, ShieldCheck } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

interface HardwareCheckProps {
    onStart?: () => void;
    canStart?: boolean;
    consentGiven?: boolean;
    onConsentChange?: (consent: boolean) => void;
}

function StatusBadge({ state }: { state: ProctoringState }) {
    if (state === ProctoringState.LOADING) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 border border-muted-foreground/30 bg-muted text-muted-foreground select-none">
                <Loader2 className="h-3 w-3 animate-spin" />
                Checking...
            </span>
        );
    }
    if (state === ProctoringState.PASSED) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 border border-emerald-200/80 bg-emerald-50/80 text-emerald-700 select-none">
                <Check className="h-3 w-3" />
                Passed
            </span>
        );
    }
    if (state === ProctoringState.ERROR) {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 border border-destructive/30 bg-destructive/10 text-destructive select-none">
                <X className="h-3 w-3" />
                Failed
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 border border-border bg-muted/40 text-muted-foreground select-none">
            Waiting
        </span>
    );
}

const REQUIRE_CAMERA = import.meta.env.VITE_REQUIRE_CAMERA === "true";

const HardwareCheck: React.FC<HardwareCheckProps> = ({
    onStart,
    canStart = true,
    consentGiven = false,
    onConsentChange,
}) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [tempConsent, setTempConsent] = useState(consentGiven);

    useEffect(() => {
        setTempConsent(consentGiven);
    }, [consentGiven]);

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
        <div className="border bg-card overflow-hidden">
            {/* Header bar matching platform tables */}
            <div className="bg-primary/10 border-b border-primary px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Prerequisites & System Check
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Status
                </span>
            </div>

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
                    <span className="absolute bottom-2 left-2 flex items-center gap-1 text-xs bg-red-600 text-white px-2 py-0.5">
                        <span className="w-1.5 h-1.5 bg-white animate-pulse" />
                        LIVE
                    </span>
                )}
            </div>}

            {/* Checklist */}
            <div className="divide-y">
                {/* Prerequisite: Privacy Consent */}
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">
                            Voice Privacy Consent
                        </span>
                        <span className="text-[11px] text-muted-foreground font-medium">
                            UU PDP No. 27/2022
                        </span>
                    </div>
                    {consentGiven ? (
                        <button
                            type="button"
                            onClick={() => {
                                setTempConsent(true);
                                setDialogOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 border border-emerald-200/80 bg-emerald-50/80 text-emerald-700 hover:bg-emerald-100/80 transition-colors cursor-pointer select-none"
                            title="Click to review consent details"
                        >
                            <Check className="h-3 w-3" />
                            Passed
                        </button>
                    ) : (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                setTempConsent(false);
                                setDialogOpen(true);
                            }}
                            className="h-7 text-xs font-semibold border-primary text-primary bg-primary/10 hover:bg-primary hover:text-primary-foreground rounded-none transition-colors"
                        >
                            Review & Agree
                        </Button>
                    )}
                </div>

                {rows.map(({ key, label }) => (
                    <div key={key} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-foreground">{label}</span>
                            <StatusBadge state={progress[key]} />
                        </div>

                        {/* Internet speed details */}
                        {key === "internet" && internetResult && (
                            <div className="mt-2 flex gap-3 text-xs">
                                <span className={internetResult.download >= thresholds.minDownloadMbps ? "text-emerald-700 font-semibold" : "text-destructive font-semibold"}>
                                    ↓ {internetResult.download} Mbps
                                </span>
                                <span className={internetResult.upload >= thresholds.minUploadMbps ? "text-emerald-700 font-semibold" : "text-destructive font-semibold"}>
                                    ↑ {internetResult.upload} Mbps
                                </span>
                                <span className={internetResult.ping <= thresholds.maxPingMs ? "text-emerald-700 font-semibold" : "text-destructive font-semibold"}>
                                    {internetResult.ping} ms
                                </span>
                            </div>
                        )}

                        {/* Mic level bar */}
                        {key === "microphone" && progress.microphone === ProctoringState.PASSED && (
                            <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 bg-muted/60 border h-2 overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-600 transition-all duration-150"
                                        style={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
                                    />
                                </div>
                                <span className="text-xs font-mono font-medium text-foreground w-8 text-right">{audioLevel}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
                {hasError && (
                    <Button variant="outline" size="sm" onClick={retryAll}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Retry
                    </Button>
                )}
                {!canStart && allPassed && (
                    <button
                        type="button"
                        onClick={() => {
                            setTempConsent(false);
                            setDialogOpen(true);
                        }}
                        className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50/80 border border-amber-200/80 px-2.5 py-1 text-left hover:bg-amber-100/80 transition-colors cursor-pointer"
                    >
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span>Please review and agree to the privacy consent to continue</span>
                    </button>
                )}
                <Button
                    size="sm"
                    className={canStart ? "ml-auto" : "ml-auto sm:ml-2"}
                    disabled={!allPassed || !canStart}
                    onClick={onStart}
                >
                    Start Interview
                </Button>
            </div>

            {/* Voice Biometrics & Privacy Consent Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-md p-6 rounded-none border border-border shadow-lg">
                    <DialogHeader className="space-y-1.5 text-left">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 bg-primary/10 text-primary border border-primary/20 shrink-0">
                                <ShieldCheck className="h-4 w-4" />
                            </div>
                            <DialogTitle className="text-sm font-bold text-foreground">
                                Voice Biometrics & Privacy Consent
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-xs text-muted-foreground font-medium">
                            Indonesian Personal Data Protection Law (UU PDP No. 27/2022)
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3.5 py-1">
                        <p className="text-xs text-foreground/80 leading-relaxed">
                            In compliance with Indonesian Personal Data Protection Law (UU PDP No. 27/2022), your voice audio is processed as specific biometric personal data. By continuing, you acknowledge and agree that:
                        </p>

                        <div className="space-y-2 border border-border bg-muted/10 p-3">
                            <div className="flex items-start gap-2.5 text-xs text-foreground">
                                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                <span>
                                    <strong className="font-semibold text-foreground">Secure Recording:</strong> Your voice is recorded and transmitted securely via encrypted connections.
                                </span>
                            </div>
                            <div className="flex items-start gap-2.5 text-xs text-foreground">
                                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                <span>
                                    <strong className="font-semibold text-foreground">AI Evaluation:</strong> Responses are transcribed and evaluated by Google Gemini for competency scoring.
                                </span>
                            </div>
                            <div className="flex items-start gap-2.5 text-xs text-foreground">
                                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                <span>
                                    <strong className="font-semibold text-foreground">Strictly Confidential:</strong> Evaluation records are private and accessible solely by the hiring team.
                                </span>
                            </div>
                        </div>

                        <div className="border bg-muted/20 p-3">
                            <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    id="dialog-pdp-consent-checkbox"
                                    checked={tempConsent}
                                    onChange={(e) => setTempConsent(e.target.checked)}
                                    className="mt-0.5 h-4 w-4 rounded-none border border-input text-primary focus:ring-primary accent-primary"
                                />
                                <span className="text-xs font-semibold text-foreground leading-snug">
                                    I have read, understood, and give explicit consent to the recording of my voice and the AI-driven processing of my biometric data in accordance with UU PDP No. 27/2022.
                                </span>
                            </label>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-2 border-t pt-3 flex-row justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-none text-xs"
                            onClick={() => setDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            className="rounded-none text-xs"
                            disabled={!tempConsent}
                            onClick={() => {
                                onConsentChange?.(true);
                                setDialogOpen(false);
                            }}
                        >
                            <Check className="h-3.5 w-3.5 mr-1.5" />
                            Confirm & Agree
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default HardwareCheck;
