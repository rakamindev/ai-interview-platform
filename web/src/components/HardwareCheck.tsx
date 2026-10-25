import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { RefreshCw, CheckCircle, XCircle, Loader2, Circle, AlertTriangle } from "lucide-react";
import type { VerifiedMicrophone } from "@/types/audio";

interface HardwareCheckProps {
    onStart: (microphone: VerifiedMicrophone) => void;
}

function StateIcon({ state }: { state: ProctoringState }) {
    if (state === ProctoringState.LOADING)
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    if (state === ProctoringState.PASSED)
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (state === ProctoringState.ERROR)
        return <XCircle className="h-4 w-4 text-destructive" />;
    if (state === ProctoringState.SKIPPED)
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <Circle className="h-4 w-4 text-muted-foreground/40" />;
}

function stateLabel(state: ProctoringState) {
    if (state === ProctoringState.LOADING) return "Checking...";
    if (state === ProctoringState.PASSED) return "Passed";
    if (state === ProctoringState.ERROR) return "Failed";
    if (state === ProctoringState.SKIPPED) return "Skipped";
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
    const [audioDeviceLabel, setAudioDeviceLabel] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const monitorContextRef = useRef<AudioContext | null>(null);
    const monitorSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const monitorActiveRef = useRef(false);
    const playbackContextRef = useRef<AudioContext | null>(null);
    const playbackOscillatorRef = useRef<OscillatorNode | null>(null);
    const playbackGainRef = useRef<GainNode | null>(null);
    const playbackTimerRef = useRef<number | null>(null);
    const playbackResolveRef = useRef<((result: boolean) => void) | null>(null);
    const stoppedTracksRef = useRef(new WeakSet<MediaStreamTrack>());
    const ownershipTransferredRef = useRef(false);

    const stopTracks = useCallback((tracks: MediaStreamTrack[]) => {
        tracks.forEach((track) => {
            if (stoppedTracksRef.current.has(track)) return;
            stoppedTracksRef.current.add(track);
            track.stop();
        });
    }, []);

    const closeContext = useCallback((context: AudioContext | null) => {
        if (!context || context.state === "closed") return;
        void context.close().catch(() => undefined);
    }, []);

    const cleanupMonitoring = useCallback(() => {
        monitorActiveRef.current = false;
        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        monitorSourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
        monitorSourceRef.current = null;
        analyserRef.current = null;
        const context = monitorContextRef.current;
        monitorContextRef.current = null;
        closeContext(context);
    }, [closeContext]);

    const cleanupPlayback = useCallback((result = false) => {
        if (playbackTimerRef.current !== null) {
            window.clearTimeout(playbackTimerRef.current);
            playbackTimerRef.current = null;
        }
        playbackOscillatorRef.current?.disconnect();
        playbackGainRef.current?.disconnect();
        playbackOscillatorRef.current = null;
        playbackGainRef.current = null;
        const context = playbackContextRef.current;
        playbackContextRef.current = null;
        closeContext(context);
        const resolve = playbackResolveRef.current;
        playbackResolveRef.current = null;
        resolve?.(result);
    }, [closeContext]);

    const releaseOwnedMedia = useCallback(() => {
        const stream = streamRef.current;
        streamRef.current = null;
        if (stream) stopTracks(stream.getTracks());
    }, [stopTracks]);

    const cleanupOwnedMedia = useCallback(() => {
        releaseOwnedMedia();
        setVideoStream(null);
        setAudioDeviceLabel(null);
    }, [releaseOwnedMedia]);

    const cleanupPreflight = useCallback((stopMedia: boolean) => {
        cleanupMonitoring();
        cleanupPlayback();
        if (stopMedia) cleanupOwnedMedia();
    }, [cleanupMonitoring, cleanupOwnedMedia, cleanupPlayback]);

    useEffect(() => {
        const { osAndBrowser, internet, camera, audio, microphone } = progress;
        setAllPassed(
            osAndBrowser === ProctoringState.PASSED &&
            (internet === ProctoringState.PASSED || internet === ProctoringState.SKIPPED) &&
            camera === ProctoringState.PASSED &&
            audio === ProctoringState.PASSED &&
            microphone === ProctoringState.PASSED
        );
    }, [progress]);

    useEffect(() => {
        if (videoRef.current && videoStream) videoRef.current.srcObject = videoStream;
    }, [videoStream]);

    useEffect(() => () => {
        cleanupMonitoring();
        cleanupPlayback();
        if (!ownershipTransferredRef.current) releaseOwnedMedia();
    }, [cleanupMonitoring, cleanupPlayback, releaseOwnedMedia]);

    const checkAudioPlayback = useCallback(async (): Promise<boolean> => {
        cleanupPlayback();
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioCtx();
            playbackContextRef.current = ctx;
            if (ctx.state === "suspended") await ctx.resume();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            playbackOscillatorRef.current = osc;
            playbackGainRef.current = gain;
            osc.connect(gain);
            gain.connect(ctx.destination);
            gain.gain.setValueAtTime(0.01, ctx.currentTime);
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            return await new Promise<boolean>((resolve) => {
                playbackResolveRef.current = resolve;
                osc.onended = () => cleanupPlayback(true);
                playbackTimerRef.current = window.setTimeout(() => cleanupPlayback(true), 250);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.1);
            });
        } catch {
            cleanupPlayback();
            return false;
        }
    }, [cleanupPlayback]);

    const startAudioLevelMonitoring = useCallback((stream: MediaStream) => {
        cleanupMonitoring();
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioCtx();
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            monitorContextRef.current = ctx;
            monitorSourceRef.current = source;
            analyserRef.current = analyser;
            monitorActiveRef.current = true;
            analyser.fftSize = 256;
            source.connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            const update = () => {
                if (!monitorActiveRef.current) return;
                analyser.getByteFrequencyData(data);
                setAudioLevel(Math.round(data.reduce((a, b) => a + b, 0) / data.length));
                animationFrameRef.current = requestAnimationFrame(update);
            };
            update();
        } catch {
            cleanupMonitoring();
        }
    }, [cleanupMonitoring]);

    // Step 1: OS & browser
    useEffect(() => {
        setProgress((p) => ({ ...p, osAndBrowser: ProctoringState.LOADING }));
        const timer = window.setTimeout(() => {
            getBrowserInfo();
            getOSInfo();
            getCurrentTime();
            setProgress((p) => ({
                ...p,
                osAndBrowser: ProctoringState.PASSED,
                internet: ProctoringState.LOADING,
            }));
        }, 800);
        return () => window.clearTimeout(timer);
    }, []);

    // Step 2: Internet
    useEffect(() => {
        if (progress.internet !== ProctoringState.LOADING) return;
        let cancelled = false;
        testInternetSpeed(DEFAULT_THRESHOLDS).then((result) => {
            if (cancelled) return;
            setInternetResult(result);
            // Passed → continue. Unavailable (own endpoint unreachable) → skip with a light warning,
            // never block the candidate on our infrastructure. Measured-but-below-threshold → fail.
            const canContinue = result.passed || result.unavailable;
            setProgress((p) => ({
                ...p,
                internet: result.passed
                    ? ProctoringState.PASSED
                    : result.unavailable
                        ? ProctoringState.SKIPPED
                        : ProctoringState.ERROR,
                ...(canContinue
                    ? REQUIRE_CAMERA
                        ? { camera: ProctoringState.LOADING }
                        : { camera: ProctoringState.PASSED, microphone: ProctoringState.LOADING }
                    : {}),
            }));
        });
        return () => { cancelled = true; };
    }, [progress.internet]);

    // Step 3: Camera + microphone (or microphone-only when camera disabled)
    useEffect(() => {
        const cameraLoading = progress.camera === ProctoringState.LOADING;
        const micLoading = !REQUIRE_CAMERA && progress.microphone === ProctoringState.LOADING;
        if (!cameraLoading && !micLoading) return;

        let cancelled = false;

        const getStream = REQUIRE_CAMERA
            ? checkCamera()
            : navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);

        getStream.then((stream) => {
            if (cancelled) {
                if (stream) stopTracks(stream.getTracks());
                return;
            }
            if (stream) {
                const previousStream = streamRef.current;
                if (previousStream && previousStream !== stream) stopTracks(previousStream.getTracks());
                streamRef.current = stream;
                if (REQUIRE_CAMERA) setVideoStream(stream);
                const audioTrack = stream.getAudioTracks().find((track) => track.readyState === "live");
                setAudioDeviceLabel(audioTrack?.label || null);
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
        return () => { cancelled = true; };
    }, [progress.camera, progress.microphone, startAudioLevelMonitoring, stopTracks]);

    // Step 4: Audio output
    useEffect(() => {
        if (progress.audio !== ProctoringState.LOADING) return;
        let cancelled = false;
        checkAudioPlayback().then((ok) => {
            if (cancelled) return;
            setProgress((p) => ({
                ...p,
                audio: ok ? ProctoringState.PASSED : ProctoringState.ERROR,
            }));
        });
        return () => { cancelled = true; };
    }, [checkAudioPlayback, progress.audio]);

    const retryAll = () => {
        ownershipTransferredRef.current = false;
        cleanupPreflight(true);
        setAudioLevel(0);
        setInternetResult(null);
        setProgress({
            osAndBrowser: ProctoringState.LOADING,
            internet: ProctoringState.WAITING,
            camera: ProctoringState.WAITING,
            audio: ProctoringState.WAITING,
            microphone: ProctoringState.WAITING,
        });
    };

    const startInterview = () => {
        const stream = streamRef.current;
        // Hand an ended track to capture as well: the capture hook owns the
        // controlled, device-aware fallback for the check-to-start race.
        const audioTrack = stream?.getAudioTracks()[0];
        if (!stream || !audioTrack) {
            cleanupPreflight(true);
            setProgress((p) => ({ ...p, microphone: ProctoringState.ERROR }));
            return;
        }

        // Transfer ownership synchronously before the parent changes state and unmounts us.
        // This prevents the unmount cleanup from stopping the handed-off audio track.
        const extraTracks = stream.getTracks().filter((track) => track !== audioTrack);
        const audioStream = extraTracks.length > 0 ? new MediaStream([audioTrack]) : stream;
        ownershipTransferredRef.current = true;
        cleanupMonitoring();
        cleanupPlayback();
        stopTracks(extraTracks);
        streamRef.current = null;
        setVideoStream(null);

        onStart({
            stream: audioStream,
            deviceId: audioTrack.getSettings().deviceId,
            label: audioTrack.label || undefined,
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
                                <span className={`text-xs w-16 text-right ${progress[key] === ProctoringState.PASSED ? "text-green-600" :
                                    progress[key] === ProctoringState.ERROR ? "text-destructive" :
                                        progress[key] === ProctoringState.SKIPPED ? "text-amber-600" :
                                            "text-muted-foreground"
                                    }`}>
                                    {stateLabel(progress[key])}
                                </span>
                            </div>
                        </div>

                        {/* Internet speed details */}
                        {key === "internet" && internetResult && !internetResult.unavailable && (
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

                        {/* Internet skipped — own endpoint unreachable, candidate may continue */}
                        {key === "internet" && progress.internet === ProctoringState.SKIPPED && (
                            <p className="mt-2 text-xs text-amber-600">
                                Speed test unavailable — your connection couldn't be measured. You can still continue.
                            </p>
                        )}

                        {/* Mic level bar */}
                        {key === "microphone" && progress.microphone === ProctoringState.PASSED && (
                            <div className="mt-2 space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className="h-full bg-green-500 transition-all duration-150"
                                            style={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-muted-foreground w-8 text-right">{audioLevel}</span>
                                </div>
                                {audioDeviceLabel && (
                                    <p className="text-xs text-muted-foreground truncate" title={audioDeviceLabel}>
                                        Input: {audioDeviceLabel}
                                    </p>
                                )}
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
                    disabled={!allPassed}
                    onClick={startInterview}
                >
                    Start Interview
                </Button>
            </div>
        </div>
    );
};

export default HardwareCheck;
