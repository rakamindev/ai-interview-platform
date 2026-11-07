
import React, { useEffect, useRef, useState } from "react";
import {
    testInternetSpeed,
    DEFAULT_THRESHOLDS,
    type InternetSpeedResult,
} from "@/utils/internetSpeedTest";
import {
    ProctoringState,
    type HardwareCheckingProgress,
    getBrowserInfo,
    getOSInfo,
    checkCamera,
    getCurrentTime,
} from "@/utils/hardwareUtils";
import { Button } from "@/components/ui/button";
import {
    RefreshCw,
    CheckCircle,
    XCircle,
    Loader2,
    Circle,
} from "lucide-react";

interface HardwareCheckProps {
    onStart?: () => void;
}

function StateIcon({ state }: { state: ProctoringState }) {
    if (state === ProctoringState.LOADING) {
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }

    if (state === ProctoringState.PASSED) {
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }

    if (state === ProctoringState.ERROR) {
        return <XCircle className="h-4 w-4 text-destructive" />;
    }

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
    osAndBrowser: ProctoringState.WAITING,
    internet: ProctoringState.WAITING,
    camera: ProctoringState.WAITING,
    audio: ProctoringState.WAITING,
    microphone: ProctoringState.WAITING,
};

const HardwareCheck: React.FC<HardwareCheckProps> = ({ onStart }) => {
    const [progress, setProgress] =
        useState<HardwareCheckingProgress>(INITIAL_PROGRESS);

    const [internetResult, setInternetResult] =
        useState<InternetSpeedResult | null>(null);

    const [videoStream, setVideoStream] =
        useState<MediaStream | null>(null);

    const [audioLevel, setAudioLevel] = useState(0);

    // Every retry increments this value to restart all checks.
    const [attempt, setAttempt] = useState(0);

    const videoRef = useRef<HTMLVideoElement>(null);

    // Keep references to active media resources for cleanup.
    const activeStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    const allPassed = Object.values(progress).every(
        (state) => state === ProctoringState.PASSED
    );

    const hasError = Object.values(progress).some(
        (state) => state === ProctoringState.ERROR
    );

    // Stop microphone monitoring and release its AudioContext.
    const stopAudioMonitoring = () => {
        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        audioSourceRef.current?.disconnect();
        audioSourceRef.current = null;

        const context = audioContextRef.current;
        audioContextRef.current = null;

        if (context && context.state !== "closed") {
            void context.close().catch(() => { });
        }

        setAudioLevel(0);
    };

    // Stop all active camera/microphone tracks.
    const stopMediaResources = (clearPreview = true) => {
        stopAudioMonitoring();

        activeStreamRef.current?.getTracks().forEach((track) => {
            track.stop();
        });

        activeStreamRef.current = null;

        if (clearPreview) {
            setVideoStream(null);
        }
    };

    // Attach the current camera stream to the preview.
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = videoStream;
        }
    }, [videoStream]);

    // Release resources when the component is unmounted.
    useEffect(() => {
        return () => {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }

            audioSourceRef.current?.disconnect();

            activeStreamRef.current?.getTracks().forEach((track) => {
                track.stop();
            });

            const context = audioContextRef.current;

            if (context && context.state !== "closed") {
                void context.close().catch(() => { });
            }
        };
    }, []);

    const checkAudioPlayback = async (): Promise<boolean> => {
        let context: AudioContext | null = null;

        try {
            const AudioCtx =
                window.AudioContext || (window as any).webkitAudioContext;

            context = new AudioCtx();

            if (context.state === "suspended") {
                await context.resume();
            }

            const oscillator = context.createOscillator();
            const gain = context.createGain();

            oscillator.connect(gain);
            gain.connect(context.destination);

            gain.gain.setValueAtTime(0.01, context.currentTime);
            oscillator.frequency.setValueAtTime(440, context.currentTime);

            oscillator.onended = () => {
                void context?.close().catch(() => { });
            };

            oscillator.start();
            oscillator.stop(context.currentTime + 0.1);

            return true;
        } catch {
            if (context && context.state !== "closed") {
                void context.close().catch(() => { });
            }

            return false;
        }
    };

    const startAudioLevelMonitoring = (stream: MediaStream) => {
        try {
            stopAudioMonitoring();

            const AudioCtx =
                window.AudioContext || (window as any).webkitAudioContext;

            const context: AudioContext = new AudioCtx();
            audioContextRef.current = context;

            const source = context.createMediaStreamSource(stream);
            audioSourceRef.current = source;

            const analyser = context.createAnalyser();
            analyser.fftSize = 256;

            source.connect(analyser);

            const data = new Uint8Array(analyser.frequencyBinCount);

            const update = () => {
                // Stop updating if this monitoring session was replaced.
                if (audioContextRef.current !== context) return;

                analyser.getByteFrequencyData(data);

                const average =
                    data.reduce((sum, value) => sum + value, 0) / data.length;

                setAudioLevel(Math.round(average));

                animationFrameRef.current =
                    requestAnimationFrame(update);
            };

            update();
        } catch {
            stopAudioMonitoring();
        }
    };

    // Step 1: OS and browser check.
    // Runs again whenever attempt changes.
    useEffect(() => {
        let cancelled = false;

        setProgress((previous) => ({
            ...previous,
            osAndBrowser: ProctoringState.LOADING,
        }));

        const timeout = window.setTimeout(() => {
            if (cancelled) return;

            getBrowserInfo();
            getOSInfo();
            getCurrentTime();

            setProgress((previous) => ({
                ...previous,
                osAndBrowser: ProctoringState.PASSED,
                internet: ProctoringState.LOADING,
            }));
        }, 800);

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [attempt]);

    // Step 2: Internet check.
    useEffect(() => {
        if (progress.internet !== ProctoringState.LOADING) return;

        let cancelled = false;

        testInternetSpeed(DEFAULT_THRESHOLDS)
            .then((result) => {
                if (cancelled) return;

                setInternetResult(result);

                setProgress((previous) => ({
                    ...previous,
                    internet: result.passed
                        ? ProctoringState.PASSED
                        : ProctoringState.ERROR,

                    ...(REQUIRE_CAMERA
                        ? { camera: ProctoringState.LOADING }
                        : {
                            camera: ProctoringState.PASSED,
                            microphone: ProctoringState.LOADING,
                        }),
                }));
            })
            .catch(() => {
                if (cancelled) return;

                setInternetResult(null);

                setProgress((previous) => ({
                    ...previous,
                    internet: ProctoringState.ERROR,
                }));
            });

        return () => {
            cancelled = true;
        };
    }, [progress.internet, attempt]);

    // Step 3: Camera and microphone check.
    useEffect(() => {
        const cameraLoading =
            progress.camera === ProctoringState.LOADING;

        const micLoading =
            !REQUIRE_CAMERA &&
            progress.microphone === ProctoringState.LOADING;

        if (!cameraLoading && !micLoading) return;

        let cancelled = false;

        const getStream = REQUIRE_CAMERA
            ? checkCamera()
            : navigator.mediaDevices
                .getUserMedia({ audio: true })
                .catch(() => null);

        getStream
            .then((stream) => {
                // A retry may have happened while permission was pending.
                if (cancelled) {
                    stream?.getTracks().forEach((track) => track.stop());
                    return;
                }

                if (!stream) {
                    setProgress((previous) => ({
                        ...previous,
                        ...(REQUIRE_CAMERA
                            ? { camera: ProctoringState.ERROR }
                            : {}),
                        microphone: ProctoringState.ERROR,
                    }));

                    return;
                }

                activeStreamRef.current = stream;

                if (REQUIRE_CAMERA) {
                    setVideoStream(stream);
                }

                startAudioLevelMonitoring(stream);

                setProgress((previous) => ({
                    ...previous,
                    ...(REQUIRE_CAMERA
                        ? { camera: ProctoringState.PASSED }
                        : {}),
                    microphone: ProctoringState.PASSED,
                    audio: ProctoringState.LOADING,
                }));
            })
            .catch(() => {
                if (cancelled) return;

                setProgress((previous) => ({
                    ...previous,
                    ...(REQUIRE_CAMERA
                        ? { camera: ProctoringState.ERROR }
                        : {}),
                    microphone: ProctoringState.ERROR,
                }));
            });

        return () => {
            cancelled = true;
        };
    }, [progress.camera, progress.microphone, attempt]);

    // Step 4: Audio output check.
    useEffect(() => {
        if (progress.audio !== ProctoringState.LOADING) return;

        let cancelled = false;

        checkAudioPlayback()
            .then((passed) => {
                if (cancelled) return;

                setProgress((previous) => ({
                    ...previous,
                    audio: passed
                        ? ProctoringState.PASSED
                        : ProctoringState.ERROR,
                }));
            })
            .catch(() => {
                if (cancelled) return;

                setProgress((previous) => ({
                    ...previous,
                    audio: ProctoringState.ERROR,
                }));
            });

        return () => {
            cancelled = true;
        };
    }, [progress.audio, attempt]);

    // Restart the complete hardware check.
    const retryAll = () => {
        stopMediaResources();

        setInternetResult(null);
        setProgress(INITIAL_PROGRESS);

        // This triggers the OS/browser effect again.
        setAttempt((previous) => previous + 1);
    };

    const thresholds = DEFAULT_THRESHOLDS;

    const rows: {
        key: keyof HardwareCheckingProgress;
        label: string;
    }[] = [
            { key: "osAndBrowser", label: "OS & browser" },
            { key: "internet", label: "Internet" },
            ...(REQUIRE_CAMERA
                ? [{ key: "camera" as const, label: "Camera" }]
                : []),
            { key: "microphone", label: "Microphone" },
            { key: "audio", label: "Audio output" },
        ];

    return (
        <div className="rounded-lg border bg-card overflow-hidden">
            {/* Camera preview */}
            {REQUIRE_CAMERA && (
                <div className="relative bg-black aspect-video">
                    {videoStream ? (
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
                            <svg
                                className="w-10 h-10 opacity-30"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <p className="text-xs">Camera not active</p>
                        </div>
                    )}

                    {progress.camera === ProctoringState.PASSED &&
                        videoStream && (
                            <span className="absolute bottom-2 left-2 flex items-center gap-1 text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                LIVE
                            </span>
                        )}
                </div>
            )}

            {/* Checklist */}
            <div className="divide-y">
                {rows.map(({ key, label }) => (
                    <div key={key} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                                {label}
                            </span>

                            <div className="flex items-center gap-2">
                                <StateIcon state={progress[key]} />

                                <span
                                    className={`text-xs w-16 text-right ${progress[key] === ProctoringState.PASSED
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
                            <div className="mt-2 flex gap-3 text-xs">
                                <span
                                    className={
                                        internetResult.download >=
                                            thresholds.minDownloadMbps
                                            ? "text-green-600"
                                            : "text-destructive"
                                    }
                                >
                                    ↓ {internetResult.download} Mbps
                                </span>

                                <span
                                    className={
                                        internetResult.upload >=
                                            thresholds.minUploadMbps
                                            ? "text-green-600"
                                            : "text-destructive"
                                    }
                                >
                                    ↑ {internetResult.upload} Mbps
                                </span>

                                <span
                                    className={
                                        internetResult.ping <=
                                            thresholds.maxPingMs
                                            ? "text-green-600"
                                            : "text-destructive"
                                    }
                                >
                                    {internetResult.ping} ms
                                </span>
                            </div>
                        )}

                        {/* Microphone level */}
                        {key === "microphone" &&
                            progress.microphone === ProctoringState.PASSED && (
                                <div className="mt-2 flex items-center gap-2">
                                    <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className="h-full bg-green-500 transition-all duration-150"
                                            style={{
                                                width: `${Math.min(
                                                    audioLevel * 2,
                                                    100
                                                )}%`,
                                            }}
                                        />
                                    </div>

                                    <span className="text-xs text-muted-foreground w-8 text-right">
                                        {audioLevel}
                                    </span>
                                </div>
                            )}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t flex items-center justify-between gap-3 bg-muted/30">
                {hasError && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={retryAll}
                    >
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Retry
                    </Button>
                )}

                <Button
                    size="sm"
                    className="ml-auto"
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
