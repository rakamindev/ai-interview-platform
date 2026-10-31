import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import VoiceBars from "@/components/interview/VoiceBars";
import InterviewTimer from "@/components/interview/InterviewTimer";
import ConnectionStatus from "@/components/interview/ConnectionStatus";
import TranscriptBubble from "@/components/interview/TranscriptBubble";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";
import { sessionsApi } from "@/services/sessions";
import HardwareCheck from "@/components/HardwareCheck";
import { CheckCircle, Mic, MicOff } from "lucide-react";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";

export default function InterviewPage() {
    const { token } = useParams<{ token: string }>();
    const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [interviewState, setInterviewState] = useState<InterviewState>("idle");
    const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
    const [transcript, setTranscript] = useState<Pick<TranscriptTurn, "speaker" | "text">[]>([]);
    const [hardwareCheckDone, setHardwareCheckDone] = useState(false); // kept for green banner
    const [connectionLostLong, setConnectionLostLong] = useState(false);
    const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
    const [manualRetryCount, setManualRetryCount] = useState(0);
    const [captureError, setCaptureError] = useState<string | null>(null);
    const MAX_MANUAL_RETRIES = 2;
    const reconnectedPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [micMuted, setMicMuted] = useState(false);
    const micMutedRef = useRef(false);

    // Fetch candidate info
    useEffect(() => {
        if (!token) return;
        sessionsApi
            .getCandidateInfo(token)
            .then((res) => {
                setCandidateInfo(res.data);
                setSessionId(res.data.session_id);
                if (res.data.session_status === "ended") setInterviewState("complete");
            })
            .catch(() => setInterviewState("complete"));
    }, [token]);

    const muteRef = useRef<(() => void) | null>(null);
    const unmuteRef = useRef<(() => void) | null>(null);

    const handleStateChange = useCallback((state: InterviewState) => {
        setInterviewState(state);

        if (state === "draining_audio") {
            // Mute mic, stop sending — wait for audio queue to drain then call audio_complete
            muteRef.current?.();
            audioCompleteCalledRef.current = false;
            // Safety timeout: call audio_complete after 10s even if drain never fires
            audioCompleteSafetyTimerRef.current = setTimeout(() => {
                callAudioComplete();
            }, 10_000);
            waitForDrain(() => callAudioComplete());
            return;
        }

        if (state === "reconnecting") {
            muteRef.current?.();
            connectionLostTimerRef.current = setTimeout(() => {
                setConnectionLostLong(true);
            }, 60_000);
        } else if (state === "connection_failed") {
            // GAP-04: stop mic, clear timers — do NOT mark as complete so UI stays distinct.
            muteRef.current?.();
            if (connectionLostTimerRef.current) {
                clearTimeout(connectionLostTimerRef.current);
                connectionLostTimerRef.current = null;
            }
            setConnectionLostLong(false);
        } else {
            if (connectionLostTimerRef.current) {
                clearTimeout(connectionLostTimerRef.current);
                connectionLostTimerRef.current = null;
            }
            setConnectionLostLong(false);
            if (state === "active" && !micMutedRef.current) unmuteRef.current?.();
        }
    }, []);

    const handleReconnected = useCallback(() => {
        if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
        setReconnectedPrompt(true);
        reconnectedPromptTimerRef.current = setTimeout(() => setReconnectedPrompt(false), 10_000);
    }, []);

    const handleTranscript = useCallback((turn: Pick<TranscriptTurn, "speaker" | "text">) => {
        setTranscript((prev) => [...prev.slice(-9), turn]); // keep last 10
    }, []);

    const { playChunk, stop: stopPlayback, scheduleAfterPlayback, waitForDrain, cancelDrain } = useAudioPlayback();
    const audioCompleteCalledRef = useRef(false);
    const audioCompleteSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const callAudioComplete = useCallback(async () => {
        if (audioCompleteCalledRef.current || !token) return;
        audioCompleteCalledRef.current = true;
        cancelDrain();
        if (audioCompleteSafetyTimerRef.current) {
            clearTimeout(audioCompleteSafetyTimerRef.current);
            audioCompleteSafetyTimerRef.current = null;
        }
        // Retry until success — endpoint now always returns ended:true or an error.
        // ended:false is no longer a valid response; any success means the session ended.
        const attempt = async (delay: number) => {
            try {
                await sessionsApi.audioComplete(token);
            } catch {
                setTimeout(() => attempt(Math.min(delay * 2, 8000)), delay);
            }
        };
        attempt(2000);
    }, [token, cancelDrain]);

    const handleSpeakerChange = useCallback(
        (newSpeaker: InterviewSpeaker) => {
            if (newSpeaker === "ai") {
                setSpeaker("ai");
                muteRef.current?.();
            } else if (newSpeaker === "candidate") {
                scheduleAfterPlayback(() => {
                    setSpeaker("candidate");
                    if (!micMutedRef.current) unmuteRef.current?.();
                });
            }
        },
        [scheduleAfterPlayback],
    );

    const { connect, send, sendJson, disconnect, connectionState } = useAudioWebSocket({
        sessionId: sessionId ?? 0,
        token,
        onAudioChunk: playChunk,
        onTranscript: handleTranscript,
        onStateChange: handleStateChange,
        onSpeakerChange: handleSpeakerChange,
        onReconnected: handleReconnected,
    });

    const {
        start: startCapture,
        stop: stopCapture,
        mute,
        unmute,
    } = useAudioCapture({
        onFrame: send,
    });

    muteRef.current = mute;
    unmuteRef.current = unmute;

    const toggleMic = useCallback(() => {
        if (micMutedRef.current) {
            micMutedRef.current = false;
            setMicMuted(false);
            unmute();
        } else {
            micMutedRef.current = true;
            setMicMuted(true);
            mute();
        }
    }, [mute, unmute]);

    const startInterview = useCallback(async () => {
        if (!sessionId) return;
        setInterviewState("connecting");
        setCaptureError(null);
        connect();
        try {
            await startCapture();
        } catch (err) {
            // GAP-04: mic/AudioWorklet failed — disconnect WS and surface connection_failed state.
            // Do NOT leave candidate in a silent "connecting" limbo.
            disconnect();
            const msg = err instanceof Error ? err.message : String(err);
            setCaptureError(msg);
            setInterviewState("connection_failed");
            return;
        }
        // Start muted — only unmute when backend sends speaker_changed: candidate.
        // This prevents mic audio from being sent during AI speech, since separate
        // AudioContexts for capture/playback break the browser's echo cancellation.
        muteRef.current?.();
    }, [sessionId, connect, startCapture, disconnect]);

    const endInterview = useCallback(async () => {
        setInterviewState("ending");
        if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
        stopCapture();
        stopPlayback();
        sendJson({ type: "end_session" });
        disconnect();
        setInterviewState("complete");
    }, [stopCapture, stopPlayback, sendJson, disconnect]);

    const wsConnectionStatus =
        interviewState === "reconnecting"
            ? connectionLostLong
                ? "lost"
                : "reconnecting"
            : connectionState === "connected"
              ? "connected"
              : "reconnecting";

    /** GAP-04: Manual retry initiated by candidate from the connection_failed panel. */
    const handleManualRetry = useCallback(() => {
        if (manualRetryCount >= MAX_MANUAL_RETRIES) return;
        setManualRetryCount((c) => c + 1);
        setCaptureError(null);
        // Give the hook a fresh start: re-invoke startInterview which re-connects WS and re-captures mic.
        startInterview();
    }, [manualRetryCount, MAX_MANUAL_RETRIES, startInterview]);

    /** GAP-04: Safe end — closes session with an auditable reason even when connection failed. */
    const endInterviewSafely = useCallback(async () => {
        stopCapture();
        stopPlayback();
        // Best-effort: try to send end_session; WS may already be closed so this is a no-op if disconnected.
        sendJson({ type: "end_session" });
        disconnect();
        setInterviewState("complete");
    }, [stopCapture, stopPlayback, sendJson, disconnect]);

    // ── State A: Pre-start ──────────────────────────────────────────────────
    if (interviewState === "idle") {
        return (
            <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 space-y-6 sm:space-y-8">
                <div className="text-center space-y-1 sm:space-y-2">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold">{candidateInfo?.role_title ?? "AI Interview"}</h1>
                    {candidateInfo && <p className="text-sm sm:text-base text-muted-foreground">{candidateInfo.time_limit_min} minutes</p>}
                </div>

                {!hardwareCheckDone ? (
                    <div className="space-y-4 sm:space-y-6">
                        <div className="bg-muted/50 rounded-lg p-4 sm:p-6 text-sm sm:text-base space-y-1.5 sm:space-y-2 text-muted-foreground">
                            <p>• This is a voice interview. Make sure you're in a quiet place.</p>
                            <p>• The AI will ask follow-up questions — there are no scripts.</p>
                            <p>• The session will last up to {candidateInfo?.time_limit_min ?? "—"} minutes.</p>
                            <p>• Your mic will be active throughout. You can end anytime.</p>
                        </div>
                        <HardwareCheck
                            onStart={() => {
                                setHardwareCheckDone(true);
                                startInterview();
                            }}
                        />
                    </div>
                ) : (
                    <div className="space-y-4 sm:space-y-6">
                        <div className="flex items-center gap-2 text-sm sm:text-base text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 sm:px-6 py-2.5 sm:py-3">
                            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                            <span>Hardware checks passed. You're ready to start.</span>
                        </div>
                        <Button className="w-full" size="lg" onClick={startInterview}>
                            <Mic className="h-4 w-4 mr-2" />
                            Start Interview
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    // State G: Connection Failed
    // GAP-04: candidate must NOT remain in a silent "connecting" or "active" state
    if (interviewState === "connection_failed") {
        const retriesLeft = MAX_MANUAL_RETRIES - manualRetryCount;
        const canRetry = retriesLeft > 0;
        return (
            <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 text-center space-y-6 sm:space-y-8">
                <div className="text-4xl sm:text-5xl">⚠️</div>
                <div className="space-y-2 sm:space-y-3">
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold">Koneksi interview bermasalah</h2>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        Kami tidak dapat menyambungkan koneksi audio interview Anda.
                        {captureError && (
                            <span className="block mt-2 text-xs sm:text-sm text-red-600">
                                {captureError.includes("Permission") || captureError.includes("NotAllowed")
                                    ? "Akses mikrofon ditolak. Pastikan izin mikrofon diizinkan di browser Anda, lalu coba lagi."
                                    : "Perangkat audio tidak dapat diinisialisasi. Pastikan mikrofon terhubung dan tidak digunakan aplikasi lain."}
                            </span>
                        )}
                    </p>
                </div>

                <div className="space-y-3 sm:space-y-4">
                    {canRetry ? (
                        <Button className="w-full sm:w-auto px-6 py-3 sm:py-4 text-base sm:text-lg" size="lg" onClick={handleManualRetry}>
                            Coba sambungkan kembali
                            <span className="ml-2 text-xs sm:text-sm opacity-70">({retriesLeft} kesempatan tersisa)</span>
                        </Button>
                    ) : (
                        <div className="text-sm sm:text-base text-muted-foreground bg-muted/50 rounded-lg px-4 sm:px-6 py-3 sm:py-4">
                            Batas percobaan ulang telah tercapai. Silakan akhiri interview dan hubungi asesor Anda.
                        </div>
                    )}

                    <Button variant="outline" className="w-full sm:w-auto px-6 py-3 sm:py-3 text-base sm:text-base" size="lg" onClick={endInterviewSafely}>
                        Akhiri interview dengan aman
                    </Button>
                </div>

                <p className="text-xs sm:text-sm text-muted-foreground">Jangan tutup halaman ini. Hubungi asesor jika masalah berlanjut.</p>
            </div>
        );
    }

    // ── State F: Complete ───────────────────────────────────────────────────
    if (interviewState === "complete") {
        return (
            <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 text-center space-y-4 sm:space-y-6">
                <div className="text-4xl sm:text-5xl lg:text-6xl">✅</div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold">Interview Complete</h2>
                <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
                    Thank you. The interview has been recorded.
                    <br />
                    The hiring team will review your results and follow up with you.
                </p>
            </div>
        );
    }

    // ── States B/C/D/E: Active interview ────────────────────────────────────
    const aiSpeaking = speaker === "ai";
    const candidateSpeaking = speaker === "candidate";

    return (
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col h-full min-h-screen">
            {/* Top bar */}
            <div className="flex items-center justify-between py-3 sm:py-4 border-b sticky top-12 bg-white z-10">
                <span className="text-sm sm:text-base font-medium">AI Interview</span>
                {candidateInfo && (
                    <InterviewTimer totalSeconds={candidateInfo.time_limit_min * 60} running={interviewState === "active"} onExpired={endInterview} />
                )}
            </div>

            {/* Reconnecting banner */}
            {interviewState === "reconnecting" &&
                (connectionLostLong ? (
                    <div className="flex items-center gap-2 text-sm sm:text-base bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 sm:px-6 py-2.5 sm:py-3 mt-2 sm:mt-3 mx-4 sm:mx-0">
                        <span className="animate-pulse">●</span>
                        <span>Connection is taking too long to restore. Please wait, and contact the interviewer if this persists.</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-sm sm:text-base bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-4 sm:px-6 py-2.5 sm:py-3 mt-2 sm:mt-3 mx-4 sm:mx-0">
                        <span className="animate-pulse">●</span>
                        <span>Briefly reconnecting — please wait a moment.</span>
                    </div>
                ))}

            {/* Reconnected prompt */}
            {reconnectedPrompt && (
                <div className="flex items-center justify-between text-sm sm:text-base bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 sm:px-6 py-2.5 sm:py-3 mt-2 sm:mt-3 mx-4 sm:mx-0">
                    <span>
                        Reconnected — please say <strong>"check"</strong> or continue your answer to resume.
                    </span>
                    <button className="ml-3 text-blue-500 hover:text-blue-700 shrink-0" onClick={() => setReconnectedPrompt(false)}>
                        ✕
                    </button>
                </div>
            )}

            {/* Voice indicator */}
            <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 sm:py-10">
                {interviewState === "connecting" ? (
                    <div className="text-sm sm:text-base text-muted-foreground animate-pulse">Connecting...</div>
                ) : interviewState === "draining_audio" ? (
                    <div className="flex flex-col items-center gap-2 text-center">
                        <VoiceBars active={true} label="AI speaking" variant="ai" />
                        <p className="text-xs sm:text-sm text-muted-foreground">Wrapping up...</p>
                    </div>
                ) : (
                    <>
                        <VoiceBars active={aiSpeaking} label={aiSpeaking ? "AI speaking" : "Listening..."} variant="ai" />

                        {candidateSpeaking && <VoiceBars active={true} label="You're speaking" variant="candidate" />}

                        {/* Transcript */}
                        {transcript.length > 0 && (
                            <div className="w-full space-y-2 sm:space-y-3 overflow-y-auto max-h-[60vh]">
                                {transcript.map((turn, i) => (
                                    <TranscriptBubble key={i} speaker={turn.speaker} text={turn.text} />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Bottom bar */}
            <div className="border-t py-3 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-0 bg-white">
                <ConnectionStatus state={wsConnectionStatus} />

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Button variant={micMuted ? "destructive" : "outline"} size="sm" onClick={toggleMic} className="w-full sm:w-auto">
                        {micMuted ? (
                            <>
                                <MicOff className="h-3.5 w-3.5 mr-1.5" /> Muted
                            </>
                        ) : (
                            <>
                                <Mic className="h-3.5 w-3.5 mr-1.5" /> Mic On
                            </>
                        )}
                    </Button>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full sm:w-auto">
                                End Interview
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>End interview?</AlertDialogTitle>
                                <AlertDialogDescription>Are you sure you want to end the interview early?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={endInterview}>End interview</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    {import.meta.env.DEV && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-xs opacity-50 w-full sm:w-auto"
                            onClick={() => sendJson({ type: "debug_force_reconnect" })}
                        >
                            ⚡ Force reconnect
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
