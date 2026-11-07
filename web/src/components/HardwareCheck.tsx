import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, Circle, Loader2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/services/api";
import type { ReadinessCheckState, ReadinessReport } from "@/types";
import { ProctoringState, checkCamera, getBrowserInfo, getOSInfo } from "@/utils/hardwareUtils";
import { THRESHOLDS, assessNetwork, measureNetwork, type NetworkAssessment, type NetworkSample } from "@/utils/readiness";

const REQUIRE_CAMERA = import.meta.env.VITE_REQUIRE_CAMERA === "true";

export interface HardwareCheckProps {
    onStart?: () => void;
    /** Called once each time every check has settled (first run and each retry). Must not block. */
    onReadiness?: (report: ReadinessReport) => void;
    /** Injectable for tests. Default: probe our own API (utils/readiness.ts). */
    measure?: () => Promise<NetworkSample>;
    requestMedia?: () => Promise<MediaStream | null>;
    checkAudioOutput?: () => Promise<boolean>;
}

const defaultMeasure = () => measureNetwork({ baseUrl: API_BASE_URL });

async function defaultRequestMedia(): Promise<MediaStream | null> {
    if (REQUIRE_CAMERA) return checkCamera();
    try {
        return (await navigator.mediaDevices?.getUserMedia({ audio: true })) ?? null;
    } catch {
        return null;
    }
}

async function defaultCheckAudioOutput(): Promise<boolean> {
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
        osc.onended = () => ctx.close().catch(() => {});
        return true;
    } catch {
        return false;
    }
}

/** Mic level meter. Returns a stop function so the loop and AudioContext don't leak. */
function startAudioLevelMonitoring(stream: MediaStream, onLevel: (level: number) => void): () => void {
    try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return () => {};
        const ctx = new AudioCtx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        let frame = 0;
        const update = () => {
            analyser.getByteFrequencyData(data);
            onLevel(Math.round(data.reduce((a, b) => a + b, 0) / data.length));
            frame = requestAnimationFrame(update);
        };
        update();
        return () => {
            cancelAnimationFrame(frame);
            ctx.close().catch(() => {});
        };
    } catch {
        return () => {};
    }
}

/** Read synchronously on first render. No timer, so it can never get stuck on "Checking...". */
function detectClient() {
    try {
        const { browser, version } = getBrowserInfo();
        return { browser: [browser, version.split(".")[0]].filter(Boolean).join(" "), os: getOSInfo() };
    } catch {
        return { browser: "Unknown", os: "Unknown" };
    }
}

function StateIcon({ state }: { state: ProctoringState }) {
    if (state === ProctoringState.LOADING) return <Loader2 aria-hidden className="h-4 w-4 animate-spin text-muted-foreground" />;
    if (state === ProctoringState.PASSED) return <CheckCircle aria-hidden className="h-4 w-4 text-green-500" />;
    if (state === ProctoringState.WARNING) return <AlertTriangle aria-hidden className="h-4 w-4 text-amber-500" />;
    if (state === ProctoringState.ERROR) return <XCircle aria-hidden className="h-4 w-4 text-destructive" />;
    return <Circle aria-hidden className="h-4 w-4 text-muted-foreground/40" />;
}

const STATE_LABEL: Record<ProctoringState, string> = {
    [ProctoringState.WAITING]: "Waiting",
    [ProctoringState.LOADING]: "Checking...",
    [ProctoringState.PASSED]: "Passed",
    [ProctoringState.WARNING]: "Weak",
    [ProctoringState.ERROR]: "Failed",
};

const STATE_COLOR: Record<ProctoringState, string> = {
    [ProctoringState.WAITING]: "text-muted-foreground",
    [ProctoringState.LOADING]: "text-muted-foreground",
    [ProctoringState.PASSED]: "text-green-600",
    [ProctoringState.WARNING]: "text-amber-600",
    [ProctoringState.ERROR]: "text-destructive",
};

function Row({ label, state, children }: { label: string; state: ProctoringState; children?: React.ReactNode }) {
    return (
        <div className="px-4 py-3" data-testid={`check-${label}`}>
            <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{label}</span>
                <div className="flex items-center gap-2 shrink-0">
                    <StateIcon state={state} />
                    <span className={`text-xs w-16 text-right ${STATE_COLOR[state]}`}>{STATE_LABEL[state]}</span>
                </div>
            </div>
            {children}
        </div>
    );
}

type Tone = "good" | "weak" | "bad" | "none";
const TONE_CLASS: Record<Tone, string> = {
    good: "text-green-600",
    weak: "text-amber-600",
    bad: "text-destructive",
    none: "text-muted-foreground",
};

function tone(value: number | null, warn: number, fail: number, higherIsBetter: boolean): Tone {
    if (value === null) return "none";
    if (higherIsBetter) return value < fail ? "bad" : value < warn ? "weak" : "good";
    return value > fail ? "bad" : value > warn ? "weak" : "good";
}

function NetworkMetrics({ sample }: { sample: NetworkSample }) {
    const { downloadMbps: down, uploadMbps: up, latencyMs: rtt } = sample;
    const mbps = (v: number | null) => (v === null ? "not measured" : `${v < 10 ? v.toFixed(2) : v.toFixed(1)} Mbps`);
    return (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <span className={TONE_CLASS[tone(down, THRESHOLDS.warn.downloadMbps, THRESHOLDS.fail.downloadMbps, true)]}>↓ {mbps(down)}</span>
            <span className={TONE_CLASS[tone(up, THRESHOLDS.warn.uploadMbps, THRESHOLDS.fail.uploadMbps, true)]}>↑ {mbps(up)}</span>
            <span className={TONE_CLASS[tone(rtt, THRESHOLDS.warn.latencyMs, THRESHOLDS.fail.latencyMs, false)]}>
                {rtt === null ? "latency not measured" : `${rtt} ms`}
            </span>
        </div>
    );
}

const toCheckState = (state: ProctoringState): ReadinessCheckState =>
    state === ProctoringState.PASSED ? "passed"
        : state === ProctoringState.WARNING ? "warn"
            : state === ProctoringState.ERROR ? "failed"
                : "skipped";

const HardwareCheck: React.FC<HardwareCheckProps> = ({
    onStart,
    onReadiness,
    measure = defaultMeasure,
    requestMedia = defaultRequestMedia,
    checkAudioOutput = defaultCheckAudioOutput,
}) => {
    const [client] = useState(detectClient);

    const [networkAttempt, setNetworkAttempt] = useState(0);
    const [network, setNetwork] = useState(ProctoringState.LOADING);
    const [sample, setSample] = useState<NetworkSample | null>(null);
    const [assessment, setAssessment] = useState<NetworkAssessment | null>(null);

    const [mediaAttempt, setMediaAttempt] = useState(0);
    const [media, setMedia] = useState(ProctoringState.LOADING);
    const [audioOut, setAudioOut] = useState(ProctoringState.WAITING);
    const [audioLevel, setAudioLevel] = useState(0);
    const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Network: measured against our own API, independent of the microphone check.
    useEffect(() => {
        let cancelled = false;
        setNetwork(ProctoringState.LOADING);
        setSample(null);
        setAssessment(null);
        const unmeasured: NetworkSample = { downloadMbps: null, uploadMbps: null, latencyMs: null };
        measure()
            .catch(() => unmeasured)
            .then((result) => {
                if (cancelled) return;
                const verdict = assessNetwork(result);
                setSample(result);
                setAssessment(verdict);
                setNetwork(
                    verdict.verdict === "pass" ? ProctoringState.PASSED
                        : verdict.verdict === "warn" ? ProctoringState.WARNING
                            : ProctoringState.ERROR,
                );
            });
        return () => {
            cancelled = true;
        };
    }, [measure, networkAttempt]);

    // Microphone (and camera if required), then audio output. Runs even if the network is weak.
    useEffect(() => {
        let cancelled = false;
        let acquired: MediaStream | null = null;
        let stopLevel = () => {};
        setMedia(ProctoringState.LOADING);
        setAudioOut(ProctoringState.WAITING);

        requestMedia().then(async (stream) => {
            if (cancelled) {
                stream?.getTracks().forEach((t) => t.stop());
                return;
            }
            if (!stream) {
                setMedia(ProctoringState.ERROR);
                return;
            }
            acquired = stream;
            if (REQUIRE_CAMERA) setVideoStream(stream);
            stopLevel = startAudioLevelMonitoring(stream, setAudioLevel);
            setMedia(ProctoringState.PASSED);
            setAudioOut(ProctoringState.LOADING);
            const ok = await checkAudioOutput();
            if (!cancelled) setAudioOut(ok ? ProctoringState.PASSED : ProctoringState.ERROR);
        });

        return () => {
            cancelled = true;
            stopLevel();
            acquired?.getTracks().forEach((t) => t.stop());
            setVideoStream(null);
        };
    }, [requestMedia, checkAudioOutput, mediaAttempt]);

    useEffect(() => {
        if (videoRef.current && videoStream) videoRef.current.srcObject = videoStream;
    }, [videoStream]);

    const settled =
        network !== ProctoringState.LOADING &&
        media !== ProctoringState.LOADING &&
        audioOut !== ProctoringState.LOADING &&
        !(media === ProctoringState.PASSED && audioOut === ProctoringState.WAITING);
    const blocked = network === ProctoringState.ERROR || media === ProctoringState.ERROR || audioOut === ProctoringState.ERROR;
    const canStart =
        media === ProctoringState.PASSED &&
        audioOut === ProctoringState.PASSED &&
        (network === ProctoringState.PASSED || network === ProctoringState.WARNING);

    // Report each settled run once, so the assessor sees the conditions and the number of attempts.
    const reportedRun = useRef<string | null>(null);
    useEffect(() => {
        const run = `${networkAttempt}:${mediaAttempt}`;
        if (!settled || !sample || !onReadiness || reportedRun.current === run) return;
        reportedRun.current = run;
        onReadiness({
            verdict: blocked ? "fail" : network === ProctoringState.WARNING ? "warn" : "pass",
            network: { download_mbps: sample.downloadMbps, upload_mbps: sample.uploadMbps, latency_ms: sample.latencyMs },
            checks: {
                browser: "passed",
                network: toCheckState(network),
                microphone: toCheckState(media),
                audio_output: toCheckState(audioOut),
            },
            client,
        });
    }, [settled, sample, onReadiness, blocked, network, media, audioOut, client, networkAttempt, mediaAttempt]);

    const retry = () => {
        if (network !== ProctoringState.PASSED) setNetworkAttempt((n) => n + 1);
        if (media === ProctoringState.ERROR || audioOut === ProctoringState.ERROR) setMediaAttempt((n) => n + 1);
    };
    const canRetry = settled && (network !== ProctoringState.PASSED || blocked);

    return (
        <div className="rounded-lg border bg-card overflow-hidden">
            {REQUIRE_CAMERA && (
                <div className="relative bg-black aspect-video">
                    {videoStream ? (
                        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                            Camera not active
                        </div>
                    )}
                </div>
            )}

            <div className="divide-y">
                <Row label="OS & browser" state={ProctoringState.PASSED}>
                    <p className="mt-1 text-xs text-muted-foreground">{client.browser} · {client.os}</p>
                </Row>

                <Row label="Internet" state={network}>
                    {network === ProctoringState.LOADING && (
                        <p role="status" className="mt-1 text-xs text-muted-foreground">
                            Testing your connection to the interview server. This takes up to 30 seconds.
                        </p>
                    )}
                    {sample && <NetworkMetrics sample={sample} />}
                    {assessment && assessment.reasons.length > 0 && (
                        <ul className={`mt-2 space-y-0.5 text-xs break-words ${network === ProctoringState.ERROR ? "text-destructive" : "text-amber-700"}`}>
                            {assessment.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                        </ul>
                    )}
                    {network === ProctoringState.WARNING && (
                        <p className="mt-2 text-xs text-muted-foreground">
                            You can still start. For a smoother interview, move closer to your Wi-Fi and pause other downloads or video calls.
                        </p>
                    )}
                    {network === ProctoringState.ERROR && (
                        <p className="mt-2 text-xs text-muted-foreground">
                            Try another network, such as a phone hotspot, then test again.
                        </p>
                    )}
                </Row>

                <Row label={REQUIRE_CAMERA ? "Camera & microphone" : "Microphone"} state={media}>
                    {media === ProctoringState.PASSED && (
                        <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden" aria-hidden>
                                <div className="h-full bg-green-500 transition-all duration-150" style={{ width: `${Math.min(audioLevel * 2, 100)}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">Say something to test</span>
                        </div>
                    )}
                    {media === ProctoringState.ERROR && (
                        <p className="mt-1 text-xs text-destructive">
                            We couldn't use your microphone. Allow access from the icon in your browser's address bar, then try again.
                        </p>
                    )}
                </Row>

                <Row label="Audio output" state={audioOut}>
                    {audioOut === ProctoringState.ERROR && (
                        <p className="mt-1 text-xs text-destructive">We couldn't play sound. Check your speakers or headphones, then try again.</p>
                    )}
                </Row>
            </div>

            <div className="px-4 py-3 border-t flex flex-wrap items-center justify-between gap-3 bg-muted/30">
                {canRetry && (
                    <Button variant="outline" size="sm" onClick={retry}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" aria-hidden />
                        {blocked ? "Retry" : "Test again"}
                    </Button>
                )}
                <div className="ml-auto flex items-center gap-3">
                    {settled && !canStart && (
                        <span id="start-blocked-reason" className="text-xs text-muted-foreground">Fix the items marked Failed to continue.</span>
                    )}
                    <Button size="sm" disabled={!canStart} onClick={onStart} aria-describedby={settled && !canStart ? "start-blocked-reason" : undefined}>
                        Start Interview
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default HardwareCheck;
