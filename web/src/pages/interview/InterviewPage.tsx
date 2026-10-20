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
import { cn } from "@/lib/utils";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";
import { sessionsApi } from "@/services/sessions";
import HardwareCheck, { REQUIRE_CAMERA } from "@/components/HardwareCheck";
import { CheckCircle, Loader2, Mic, MicOff, RefreshCw, X, XCircle } from "lucide-react";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";

function SpeakerStage({
  title,
  active,
  label,
  variant,
}: {
  title: string;
  active: boolean;
  label: string;
  variant: "ai" | "candidate";
}) {
  const activeStyle = variant === "ai"
    ? "border-primary/40 bg-primary/5"
    : "border-secondary/70 bg-secondary/10";
  const voiceStyle = variant === "ai" ? "bg-primary/10" : "bg-secondary/20";

  return (
    <section
      aria-label={`${title}: ${label}`}
      className={cn(
        "flex min-h-32 min-w-0 flex-col rounded-xl border p-2.5 transition-colors sm:min-h-44 sm:p-5 lg:min-h-52 lg:p-6",
        active ? activeStyle : "border-border bg-white"
      )}
    >
      <h2 className="text-sm font-semibold">{title}</h2>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-2 sm:py-5">
          <div className={cn("flex h-16 w-16 items-center justify-center rounded-full sm:h-28 sm:w-28", voiceStyle)}>
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-white sm:h-24 sm:w-24">
              <VoiceBars active={active} variant={variant} />
            </div>
          </div>
          <span className="max-w-[14ch] break-words text-center text-sm leading-snug text-muted-foreground sm:max-w-full">{label}</span>
        </div>
    </section>
  );
}

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [candidateInfoLoading, setCandidateInfoLoading] = useState(true);
  const [candidateInfoError, setCandidateInfoError] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<Pick<TranscriptTurn, "speaker" | "text">[]>([]);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [noticeRead, setNoticeRead] = useState(false);
  const [hardwareCheckStarted, setHardwareCheckStarted] = useState(false);
  const [privacyAckSubmitting, setPrivacyAckSubmitting] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [micAutoMuted, setMicAutoMuted] = useState(true);
  const [completionReason, setCompletionReason] = useState<string | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const reconnectedPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const speakerRef = useRef<InterviewSpeaker>(null);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);

  const loadCandidateInfo = useCallback(async () => {
    if (!token) {
      setCandidateInfoLoading(false);
      setCandidateInfoError(true);
      return;
    }
    setCandidateInfoLoading(true);
    setCandidateInfoError(false);
    try {
      const res = await sessionsApi.getCandidateInfo(token);
      setCandidateInfo(res.data);
      setSessionId(res.data.session_id);
      setPrivacyAcknowledged(res.data.privacy_acknowledged);
      if (res.data.session_status === "ended" || res.data.session_status === "failed") {
        setCompletionReason(res.data.end_reason ?? null);
        setInterviewState(res.data.session_status === "failed" || res.data.end_reason === "error" ? "failed" : "complete");
      }
    } catch {
      setCandidateInfoError(true);
    } finally {
      setCandidateInfoLoading(false);
    }
  }, [token]);

  useEffect(() => { loadCandidateInfo(); }, [loadCandidateInfo]);

  useEffect(() => {
    if (interviewState !== "ending") return;
    const timer = window.setTimeout(() => {
      setFailureMessage("We couldn't confirm that the interview ended. Contact the interviewer before trying again.");
      setInterviewState("failed");
    }, 12_000);
    return () => window.clearTimeout(timer);
  }, [interviewState]);

  const muteRef = useRef<(() => void) | null>(null);
  const unmuteRef = useRef<(() => void) | null>(null);

  const handleStateChange = useCallback((state: InterviewState) => {
    setInterviewState(state);

    if (state === "draining_audio") {
      // Mute mic, stop sending — wait for audio queue to drain then call audio_complete
      setMicAutoMuted(true);
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
      setMicAutoMuted(true);
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
      if (state === "active" && !micMutedRef.current && speakerRef.current === "candidate") {
        setMicAutoMuted(false);
        unmuteRef.current?.();
      }
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

  useEffect(() => {
    const container = transcriptContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [transcript]);

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
      speakerRef.current = "ai";
      setMicAutoMuted(true);
      setSpeaker("ai");
      muteRef.current?.();
    } else if (newSpeaker === "candidate") {
      scheduleAfterPlayback(() => {
        speakerRef.current = "candidate";
        setSpeaker("candidate");
        if (!micMutedRef.current) {
          setMicAutoMuted(false);
          unmuteRef.current?.();
        }
      });
    }
  }, [scheduleAfterPlayback]);

  const handleSessionEnded = useCallback((reason: string, message?: string) => {
    setCompletionReason(reason);
    if (message) setFailureMessage(message);
  }, []);

  const handleFatalError = useCallback((message: string) => {
    setFailureMessage(message);
  }, []);

  const { connect, send, sendJson, disconnect, connectionState } = useAudioWebSocket({
    sessionId: sessionId ?? 0,
    token,
    onAudioChunk: playChunk,
    onTranscript: handleTranscript,
    onStateChange: handleStateChange,
    onSpeakerChange: handleSpeakerChange,
    onSessionEnded: handleSessionEnded,
    onFatalError: handleFatalError,
    onReconnected: handleReconnected,
  });

  const { start: startCapture, stop: stopCapture, mute, unmute } = useAudioCapture({
    onFrame: send,
    onError: () => {
      setFailureMessage("Microphone access failed. Check your browser permission and reload the interview link.");
      setInterviewState("failed");
    },
  });

  muteRef.current = mute;
  unmuteRef.current = unmute;

  useEffect(() => {
    if (interviewState !== "complete" && interviewState !== "failed") return;
    muteRef.current?.();
    stopCapture();
    stopPlayback();
    disconnect();
  }, [interviewState, stopCapture, stopPlayback, disconnect]);

  const toggleMic = useCallback(() => {
    if (micMutedRef.current) {
      micMutedRef.current = false;
      setMicMuted(false);
      if (speakerRef.current === "candidate") {
        setMicAutoMuted(false);
        unmute();
      }
    } else {
      micMutedRef.current = true;
      setMicMuted(true);
      setMicAutoMuted(true);
      mute();
    }
  }, [mute, unmute]);

  const startInterview = useCallback(async () => {
    if (!sessionId) return;
    setInterviewState("connecting");
    const captureStarted = await startCapture();
    if (!captureStarted) return;
    connect();
    // Start muted — only unmute when backend sends speaker_changed: candidate.
    // This prevents mic audio from being sent during AI speech, since separate
    // AudioContexts for capture/playback break the browser's echo cancellation.
    muteRef.current?.();
  }, [sessionId, connect, startCapture]);

  const endInterview = useCallback(async () => {
    setInterviewState("ending");
    setMicAutoMuted(true);
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    if (connectionLostTimerRef.current) clearTimeout(connectionLostTimerRef.current);
    stopCapture();
    stopPlayback();
    sendJson({ type: "end_session" });
  }, [stopCapture, stopPlayback, sendJson]);

  const continueToDeviceCheck = async () => {
    if (privacyAckSubmitting) return;
    if (!privacyAcknowledged && !noticeRead) {
      setPrivacyError("Read the voice data notice before continuing.");
      return;
    }

    setPrivacyError(null);
    if (!privacyAcknowledged) {
      if (!token) return;
      setPrivacyAckSubmitting(true);
      try {
        await sessionsApi.acknowledgePrivacy(token);
        setPrivacyAcknowledged(true);
      } catch {
        setPrivacyError("We couldn't save your acknowledgement. Check your connection and try again.");
        return;
      } finally {
        setPrivacyAckSubmitting(false);
      }
    }

    setHardwareCheckStarted(true);
  };

  const wsConnectionStatus =
    interviewState === "connecting"
      ? "connecting"
      : interviewState === "reconnecting"
      ? connectionLostLong ? "lost" : "reconnecting"
      : connectionState === "connected"
      ? "connected"
      : "reconnecting";

  // ── State A: Pre-start ──────────────────────────────────────────────────
  if (candidateInfoLoading) {
    return (
      <div role="status" className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-4 py-12">
        <p className="text-sm text-muted-foreground">Loading your interview details…</p>
      </div>
    );
  }

  if (candidateInfoError) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-12">
        <div role="alert" className="w-full space-y-4 rounded-xl border bg-white p-6 text-center sm:p-8">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Interview link unavailable</h1>
            <p className="text-sm text-muted-foreground">We couldn’t load this interview. Check your connection or ask the interviewer for a new link.</p>
          </div>
          <Button variant="outline" onClick={loadCandidateInfo}>Try again</Button>
        </div>
      </div>
    );
  }

  if (interviewState === "idle") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{candidateInfo?.role_title ?? "AI Interview"}</h1>
          {candidateInfo && (
            <p className="text-sm text-muted-foreground">
              Interview time: {candidateInfo.time_limit_min} minutes
            </p>
          )}
        </div>

        <section className="rounded-xl border bg-white p-4 text-sm sm:p-5">
          <h2 className="font-semibold">Before you begin</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
            <li>Find a quiet place for this voice interview.</li>
            <li>The interviewer may ask follow-up questions.</li>
            <li>You can end the interview at any time.</li>
          </ul>
        </section>

        <section aria-labelledby="voice-data-notice" className="space-y-3 rounded-xl border bg-white p-4 text-sm sm:p-5">
          <div className="space-y-1">
            <h2 id="voice-data-notice" className="font-semibold">Voice data and privacy (UU PDP)</h2>
            <p className="text-muted-foreground">
              Your microphone audio is sent to Google Gemini for real-time processing. We save a transcript and interview results for the hiring team to review.
            </p>
            {REQUIRE_CAMERA && <p className="text-muted-foreground">Your camera is used for the device check and preview. Video is not sent with your interview audio.</p>}
            <p className="text-muted-foreground">
              Share only information relevant to the role. For questions about data handling or requests about your personal data, contact the recruiter who sent this invitation.
            </p>
          </div>

          {!privacyAcknowledged && (
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md py-2 text-sm">
              <input
                type="checkbox"
                checked={noticeRead}
                onChange={(event) => {
                  setNoticeRead(event.target.checked);
                  setPrivacyError(null);
                }}
                className="mt-0.5 h-5 w-5 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <span>I have read the voice data notice above.</span>
            </label>
          )}

          {privacyError && <p role="alert" className="text-sm text-destructive">{privacyError}</p>}

          {!hardwareCheckStarted ? (
            <Button
              type="button"
              size="lg"
              disabled={privacyAckSubmitting || (!privacyAcknowledged && !noticeRead)}
              onClick={continueToDeviceCheck}
            >
              {privacyAckSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Continue to device check
            </Button>
          ) : (
            <p role="status" className="text-xs text-green-800">Notice acknowledged. Microphone access is requested during the device check below.</p>
          )}
        </section>

        {hardwareCheckStarted && <HardwareCheck onStart={startInterview} />}
      </div>
    );
  }

  if (interviewState === "failed") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-10 sm:py-12">
        <section role="alert" className="w-full space-y-4 rounded-xl border bg-white p-6 text-center sm:p-8">
          <XCircle className="mx-auto h-9 w-9 text-destructive" aria-hidden="true" />
          <h1 className="text-xl font-semibold">Interview interrupted</h1>
          <p className="text-sm text-muted-foreground">
            {failureMessage ?? "The interview ended before we could confirm it was saved."}
          </p>
          <p className="text-sm text-muted-foreground">Contact the recruiter who sent your invitation for the next step.</p>
        </section>
      </div>
    );
  }

  if (interviewState === "complete") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-10 sm:py-12">
        <section className="w-full space-y-4 rounded-xl border bg-white p-6 text-center sm:p-8">
          <CheckCircle className="mx-auto h-9 w-9 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-semibold">{completionReason === "time_ceiling" ? "Interview time is up" : "Interview complete"}</h1>
          <p className="text-sm text-muted-foreground">Thank you for taking part. The hiring team can review your transcript and results after processing is complete.</p>
          <p className="text-sm text-muted-foreground">You can close this page. For questions about your personal data, contact the recruiter who sent your invitation.</p>
        </section>
      </div>
    );
  }

  // ── States B/C/D/E: Active interview ────────────────────────────────────
  const aiSpeaking = speaker === "ai";
  const candidateSpeaking = speaker === "candidate";
  const reconnecting = interviewState === "reconnecting";
  const aiStageActive = !reconnecting && (aiSpeaking || interviewState === "draining_audio");
  const candidateStageActive = !reconnecting && candidateSpeaking;
  const candidateStageLabel = reconnecting
    ? "Reconnecting"
    : micMuted
    ? "Microphone muted"
    : candidateSpeaking
    ? "Your turn to speak"
    : aiSpeaking
    ? "Listening"
    : micAutoMuted
    ? "Mic waits for your turn"
    : "Ready when you are";
  const micButtonLabel = micMuted ? "Muted" : micAutoMuted ? (aiSpeaking ? "Paused for AI" : "Waiting for your turn") : "Mic on";

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-5xl flex-1 flex-col px-3 sm:px-4">
      {/* Top bar */}
      <div className="sticky top-14 z-20 flex min-w-0 items-center justify-between gap-3 border-b bg-white px-4 py-3 sm:px-5">
        <span className="min-w-0 truncate text-sm font-medium">AI Interview</span>
        {interviewState === "ending" ? (
          <span role="status" aria-live="polite" className="shrink-0 text-sm text-muted-foreground">Ending interview...</span>
        ) : candidateInfo && (
          <InterviewTimer
            totalSeconds={candidateInfo.time_limit_min * 60}
            running={interviewState === "active"}
            onExpired={endInterview}
          />
        )}
      </div>

      {/* Reconnecting banner */}
      {interviewState === "reconnecting" && (
        connectionLostLong ? (
          <div className="mt-2 flex min-w-0 items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
            <span className="animate-pulse">●</span>
            <span className="min-w-0 break-words">Connection is taking a while to restore. Please wait. Contact the interviewer if this continues.</span>
          </div>
        ) : (
          <div className="mt-2 flex min-w-0 items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2.5 text-sm text-yellow-800">
            <span className="animate-pulse">●</span>
            <span className="min-w-0 break-words">Briefly reconnecting. Please wait a moment.</span>
          </div>
        )
      )}

      {/* Reconnected prompt */}
      {reconnectedPrompt && (
        <div className="mt-2 flex min-w-0 items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 sm:px-4">
          <span className="min-w-0 break-words">Reconnected. Say <strong>"check"</strong> or continue your answer to resume.</span>
          <button
            type="button"
            aria-label="Dismiss reconnection message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setReconnectedPrompt(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Speaker stage and transcript */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 py-4 sm:gap-5 sm:py-5">
        {interviewState === "connecting" && (
          <p role="status" className="text-center text-sm text-muted-foreground">Connecting to your interview…</p>
        )}
        <div className="grid grid-cols-2 gap-2 sm:gap-5">
          <SpeakerStage
            title="AI interviewer"
            active={aiStageActive}
            label={reconnecting ? "Reconnecting" : interviewState === "draining_audio" ? "Wrapping up" : aiSpeaking ? "AI speaking" : "Waiting"}
            variant="ai"
          />
          <SpeakerStage
            title="You"
            active={candidateStageActive}
            label={candidateStageLabel}
            variant="candidate"
          />
        </div>

        {transcript.length > 0 && (
          <section aria-label="Recent interview conversation" className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Conversation</h2>
              <span className="text-xs text-muted-foreground">Recent turns</span>
            </div>
            <div
              ref={transcriptContainerRef}
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              className="min-h-0 max-h-[32dvh] flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1 sm:max-h-[38dvh] lg:max-h-[420px]"
            >
              {transcript.map((turn, i) => (
                <TranscriptBubble key={i} speaker={turn.speaker} text={turn.text} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-0 z-20 flex flex-col gap-3 border-t bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
        {interviewState === "ending" ? (
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">Saving your responses. Please keep this page open.</p>
        ) : (
          <ConnectionStatus state={wsConnectionStatus} />
        )}

        {interviewState !== "ending" && (
          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end sm:gap-3">
            <Button
              variant={micMuted ? "destructive" : "outline"}
              size="sm"
              aria-label={micMuted ? "Unmute microphone" : micAutoMuted ? aiSpeaking ? "Microphone paused while AI speaks" : "Microphone will open on your turn" : "Mute microphone"}
              aria-pressed={micMuted}
              disabled={interviewState === "connecting" || reconnecting}
              onClick={toggleMic}
            >
              {micMuted ? <MicOff className="h-3.5 w-3.5 mr-1.5" /> : <Mic className="h-3.5 w-3.5 mr-1.5" />}
              {micButtonLabel}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={interviewState === "connecting"}>End interview</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>End interview?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ending will close this interview. You won't be able to resume afterward.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep interviewing</AlertDialogCancel>
                  <AlertDialogAction onClick={endInterview}>End interview</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {import.meta.env.DEV && (
              <Button variant="outline" size="sm" className="text-xs opacity-50"
                onClick={() => sendJson({ type: "debug_force_reconnect" })}>
                <><RefreshCw className="h-3.5 w-3.5 mr-1" />Force reconnect</>
              </Button>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
