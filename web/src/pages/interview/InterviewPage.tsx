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
import InterviewError from "@/components/interview/InterviewError";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";
import { sessionsApi } from "@/services/sessions";
import HardwareCheck from "@/components/HardwareCheck";
import { CheckCircle, Mic, MicOff } from "lucide-react";
import type {
  CandidateInfo,
  InterviewErrorInfo,
  InterviewState,
  InterviewSpeaker,
  TranscriptTurn,
} from "@/types";
import type { VerifiedMicrophone } from "@/types/audio";

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [interviewError, setInterviewError] = useState<InterviewErrorInfo | null>(null);
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  const [initialRemainingSeconds, setInitialRemainingSeconds] = useState(0);
  const [restoredTranscript, setRestoredTranscript] = useState(false);
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false); // kept for green banner
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const reconnectedPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);
  const verifiedMicrophoneRef = useRef<VerifiedMicrophone | null>(null);
  const [microphoneNotice, setMicrophoneNotice] = useState<string | null>(null);

  // Fetch candidate info. A failed fetch here must NOT be presented as a
  // successful interview — surface a truthful error screen instead (F-07).
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    sessionsApi
      .getCandidateInfo(token)
      .then((res) => {
        if (cancelled) return;
        setCandidateInfo(res.data);
        setSessionId(res.data.session_id);
        setDeadlineAt(res.data.deadline_at ?? null);
        setInitialRemainingSeconds(res.data.remaining_seconds ?? 0);
        if (res.data.session_status === "ended" || res.data.session_status === "failed") {
          setInterviewState("complete");
        } else if (res.data.session_status === "active") {
          const restored = res.data.recent_transcript ?? [];
          setTranscript(restored);
          setRestoredTranscript(restored.length > 0);
          if (res.data.resume_available === false) {
            setInterviewError({
              kind: "resume_unavailable",
              message: res.data.recovery_message ?? undefined,
              recoverable: false,
            });
            setInterviewState("error");
          } else {
            setInterviewState("resume");
          }
        } else {
          // Reset back to pre-start — relevant after a retry from the error screen.
          setInterviewState("idle");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        // Distinguish an invalid/expired invite (401/404) from a transient
        // network failure — the former is not worth retrying, the latter is.
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 404) {
          setInterviewError({
            kind: "auth_failed",
            message: "This interview link isn't valid or has expired.",
            recoverable: false,
          });
        } else {
          setInterviewError({
            kind: "load_failed",
            message: "We couldn't load your interview details.",
            recoverable: true,
          });
        }
        setInterviewState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token, loadAttempt]);

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
    } else {
      if (connectionLostTimerRef.current) {
        clearTimeout(connectionLostTimerRef.current);
        connectionLostTimerRef.current = null;
      }
      setConnectionLostLong(false);
    }
  }, []);

  const handleReconnected = useCallback(() => {
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    setReconnectedPrompt(true);
    reconnectedPromptTimerRef.current = setTimeout(() => setReconnectedPrompt(false), 10_000);
  }, []);

  const handleTranscript = useCallback((turn: TranscriptTurn) => {
    setTranscript((prev) => {
      const withoutDuplicate = prev.filter((item) =>
        turn.turn_number > 0
          ? item.turn_number !== turn.turn_number
          : item.id !== turn.id
      );
      return [...withoutDuplicate, turn]
        .sort((a, b) => a.turn_number - b.turn_number)
        .slice(-20);
    });
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

  const handleSpeakerChange = useCallback((newSpeaker: InterviewSpeaker) => {
    if (newSpeaker === "ai") {
      setSpeaker("ai");
      muteRef.current?.();
    } else if (newSpeaker === "candidate") {
      scheduleAfterPlayback(() => {
        setSpeaker("candidate");
        if (!micMutedRef.current) unmuteRef.current?.();
      });
    }
  }, [scheduleAfterPlayback]);

  const handleFatalError = useCallback((error: InterviewErrorInfo) => {
    setInterviewError(error);
    // Stop capture/playback/WS so a failed session doesn't keep the mic hot.
    stopCaptureRef.current?.();
    stopPlaybackRef.current?.();
  }, []);

  const stopCaptureRef = useRef<(() => void) | null>(null);
  const stopPlaybackRef = useRef<(() => void) | null>(null);
  const disconnectRef = useRef<(() => void) | null>(null);

  const handleTiming = useCallback((timing: { deadlineAt: string; remainingSeconds: number }) => {
    setDeadlineAt(timing.deadlineAt);
    setInitialRemainingSeconds(timing.remainingSeconds);
  }, []);

  const handleTakenOver = useCallback(() => {
    stopCaptureRef.current?.();
    stopPlaybackRef.current?.();
    setSpeaker(null);
  }, []);

  const handleCaptureError = useCallback((error: Error) => {
    setInterviewError({
      kind: "microphone_unavailable",
      message: error.message,
      recoverable: true,
    });
    setInterviewState("error");
    stopCaptureRef.current?.();
    stopPlaybackRef.current?.();
    disconnectRef.current?.();
  }, []);

  const { connect, send, sendJson, disconnect, connectionState } = useAudioWebSocket({
    sessionId: sessionId ?? 0,
    token,
    onAudioChunk: playChunk,
    onTranscript: handleTranscript,
    onStateChange: handleStateChange,
    onSpeakerChange: handleSpeakerChange,
    onReconnected: handleReconnected,
    onTiming: handleTiming,
    onTakenOver: handleTakenOver,
    onFatalError: handleFatalError,
  });

  const { start: startCapture, stop: stopCapture, mute, unmute } = useAudioCapture({
    onFrame: send,
    onError: handleCaptureError,
  });

  stopCaptureRef.current = stopCapture;
  stopPlaybackRef.current = stopPlayback;
  disconnectRef.current = disconnect;

  muteRef.current = mute;
  unmuteRef.current = unmute;

  const toggleMic = useCallback(() => {
    if (micMutedRef.current) {
      micMutedRef.current = false;
      setMicMuted(false);
      if (speaker === "candidate") unmute();
    } else {
      micMutedRef.current = true;
      setMicMuted(true);
      mute();
    }
  }, [mute, speaker, unmute]);

  const startInterview = useCallback(async (verified?: VerifiedMicrophone) => {
    if (!sessionId) return;
    const microphone = verified ?? verifiedMicrophoneRef.current ?? undefined;
    // Close the gate before either the WebSocket or worklet can emit a frame.
    mute();
    setSpeaker(null);
    setMicrophoneNotice(null);
    setInterviewState("connecting");
    connect();
    try {
      const result = await startCapture(microphone);
      verifiedMicrophoneRef.current = null;
      if (result.source === "cancelled") {
        disconnect();
        return;
      }
      if (result.source === "fallback") {
        const device = result.label ? ` (${result.label})` : "";
        setMicrophoneNotice(
          result.deviceChanged
            ? `The verified microphone disconnected. Your browser switched to another input${device}.`
            : `The verified microphone stream ended, so the browser reconnected it${device}.`
        );
      }
    } catch {
      verifiedMicrophoneRef.current = null;
      disconnect();
    }
  }, [connect, disconnect, mute, sessionId, startCapture]);

  const handleHardwareStart = useCallback((microphone: VerifiedMicrophone) => {
    verifiedMicrophoneRef.current = microphone;
    setHardwareCheckDone(true);
    void startInterview(microphone);
  }, [startInterview]);

  const endInterview = useCallback(async () => {
    setInterviewState("ending");
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    stopCapture();
    stopPlayback();
    sendJson({ type: "end_session" });
    disconnect();
    setInterviewState("complete");
  }, [stopCapture, stopPlayback, sendJson, disconnect]);

  const confirmTakeover = useCallback(() => {
    setInterviewState("connecting");
    sendJson({ type: "takeover" });
  }, [sendJson]);

  const wsConnectionStatus =
    interviewState === "reconnecting"
      ? connectionLostLong ? "lost" : "reconnecting"
      : connectionState === "connected"
      ? "connected"
      : "reconnecting";

  // ── State A: Pre-start ──────────────────────────────────────────────────
  if (interviewState === "idle") {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold">{candidateInfo?.role_title ?? "AI Interview"}</h1>
          {candidateInfo && (
            <p className="text-sm text-muted-foreground">
              {candidateInfo.time_limit_min} minutes
            </p>
          )}
        </div>

        {!hardwareCheckDone ? (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1.5 text-muted-foreground">
              <p>• This is a voice interview. Make sure you're in a quiet place.</p>
              <p>• The AI will ask follow-up questions — there are no scripts.</p>
              <p>• The session will last up to {candidateInfo?.time_limit_min ?? "—"} minutes.</p>
              <p>• Your mic will be active throughout. You can end anytime.</p>
            </div>
            <HardwareCheck onStart={handleHardwareStart} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>Hardware checks passed. You're ready to start.</span>
            </div>
            <Button className="w-full" size="lg" onClick={() => void startInterview()}>
              <Mic className="h-4 w-4 mr-2" />
              Start Interview
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (interviewState === "resume") {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold">Resume interview</h1>
          <p className="text-sm text-muted-foreground">
            Your original interview clock is still running.
          </p>
          {deadlineAt && (
            <div className="flex items-center justify-center gap-2" aria-label="Interview time remaining">
              <InterviewTimer
                deadlineAt={deadlineAt}
                initialRemainingSeconds={initialRemainingSeconds}
                running={true}
              />
              <span className="text-sm text-muted-foreground">remaining</span>
            </div>
          )}
        </div>

        {transcript.length > 0 && (
          <div className="space-y-3">
            <p role="status" aria-live="polite" className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
              Recent conversation restored. Previous audio will not be replayed.
            </p>
            <div className="space-y-2 max-h-[45vh] overflow-y-auto" aria-label="Recent interview transcript">
              {transcript.map((turn) => (
                <TranscriptBubble key={turn.id || turn.turn_number} speaker={turn.speaker} text={turn.text} />
              ))}
            </div>
          </div>
        )}

        <Button className="w-full" size="lg" onClick={() => void startInterview()}>
          <Mic className="h-4 w-4 mr-2" />
          Resume interview
        </Button>
      </div>
    );
  }

  if (interviewState === "in_use") {
    return (
      <div role="alert" className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-semibold">Interview already open</h2>
        <p className="text-sm text-muted-foreground">
          This interview is active in another tab or device. Continuing here will stop the other connection.
        </p>
        <Button onClick={confirmTakeover}>Continue here</Button>
      </div>
    );
  }

  if (interviewState === "taken_over") {
    return (
      <div role="status" aria-live="assertive" className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-semibold">Interview continued elsewhere</h2>
        <p className="text-sm text-muted-foreground">
          This tab is no longer connected. Continue in the tab or device that took over the interview.
        </p>
      </div>
    );
  }

  // ── State E2: Error ─────────────────────────────────────────────────────
  if (interviewState === "error") {
    return (
      <InterviewError
        error={interviewError ?? { kind: "load_failed", recoverable: true }}
        onRetry={() => {
          if (interviewError?.kind === "load_failed") {
            // Re-run the candidate-info fetch. The effect re-sets state on
            // success (idle/active) or failure (error) — no blink through idle.
            setLoadAttempt((n) => n + 1);
          } else {
            // WS/connection failure — restart the whole session flow.
            setInterviewError(null);
            setTranscript([]);
            setSpeaker(null);
            if (interviewError?.kind === "microphone_unavailable") {
              verifiedMicrophoneRef.current = null;
              setHardwareCheckDone(false);
            }
            setInterviewState("idle");
          }
        }}
      />
    );
  }

  // ── State F: Complete ───────────────────────────────────────────────────
  if (interviewState === "complete") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100/80 text-green-600">
          <CheckCircle className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold">Interview Complete</h2>
        <p className="text-sm text-muted-foreground">
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
    <div className="max-w-xl mx-auto px-4 flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between py-3 border-b sticky top-12 bg-white z-10">
        <span className="text-sm font-medium">AI Interview</span>
        {candidateInfo && deadlineAt && (
          <InterviewTimer
            deadlineAt={deadlineAt}
            initialRemainingSeconds={initialRemainingSeconds}
            running={interviewState === "active"}
          />
        )}
      </div>

      {restoredTranscript && (
        <p role="status" aria-live="polite" className="sr-only">
          Recent conversation restored. Previous audio was not replayed.
        </p>
      )}

      {microphoneNotice && (
        <p role="status" className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-2.5 mt-2">
          {microphoneNotice}
        </p>
      )}

      {/* Reconnecting banner */}
      {interviewState === "reconnecting" && (
        connectionLostLong ? (
          <div className="flex items-center gap-2 text-sm bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-2.5 mt-2">
            <span className="animate-pulse">●</span>
            <span>Connection is taking too long to restore. Please wait, and contact the interviewer if this persists.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-4 py-2.5 mt-2">
            <span className="animate-pulse">●</span>
            <span>Briefly reconnecting — please wait a moment.</span>
          </div>
        )
      )}

      {/* Reconnected prompt */}
      {reconnectedPrompt && (
        <div className="flex items-center justify-between text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-2.5 mt-2">
          <span>Reconnected — please say <strong>"check"</strong> or continue your answer to resume.</span>
          <button className="ml-3 text-blue-500 hover:text-blue-700 shrink-0" onClick={() => setReconnectedPrompt(false)}>✕</button>
        </div>
      )}

      {/* Voice indicator */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
        {interviewState === "connecting" ? (
          <div className="text-sm text-muted-foreground animate-pulse">Connecting...</div>
        ) : interviewState === "draining_audio" ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <VoiceBars active={true} label="AI speaking" variant="ai" />
            <p className="text-xs text-muted-foreground">Wrapping up...</p>
          </div>
        ) : (
          <>
            <VoiceBars
              active={aiSpeaking}
              label={aiSpeaking ? "AI speaking" : "Listening..."}
              variant="ai"
            />

            {candidateSpeaking && (
              <VoiceBars
                active={true}
                label="You're speaking"
                variant="candidate"
              />
            )}

            {/* Transcript */}
            {transcript.length > 0 && (
              <div className="w-full space-y-2 overflow-y-auto max-h-[60vh]">
                {transcript.map((turn) => (
                  <TranscriptBubble key={turn.id || turn.turn_number} speaker={turn.speaker} text={turn.text} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div className="border-t py-3 flex flex-wrap items-center justify-between gap-2 sticky bottom-0 bg-white">
        <ConnectionStatus state={wsConnectionStatus} />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={micMuted ? "destructive" : "outline"}
            size="sm"
            onClick={toggleMic}
          >
            {micMuted ? (
              <><MicOff className="h-3.5 w-3.5 mr-1.5" /> Muted</>
            ) : (
              <><Mic className="h-3.5 w-3.5 mr-1.5" /> Mic On</>
            )}
          </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">End Interview</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>End interview?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to end the interview early?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={endInterview}>End interview</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {import.meta.env.DEV && (
          <Button variant="outline" size="sm" className="text-xs opacity-50"
            onClick={() => sendJson({ type: "debug_force_reconnect" })}>
            ⚡ Force reconnect
          </Button>
        )}
        </div>
      </div>

    </div>
  );
}
