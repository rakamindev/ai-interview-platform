import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import ConsentGate from "@/components/consent/ConsentGate";
import { CheckCircle, CheckCircle2, Clock3, Mic, MicOff, ShieldCheck } from "lucide-react";
import { httpStatus } from "@/lib/httpError";
import type {
  CandidateInfo,
  InterviewState,
  InterviewSpeaker,
  TranscriptTurn,
} from "@/types";

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(
    null,
  );
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [candidateError, setCandidateError] = useState<
    "invalid" | "unavailable" | null
  >(null);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<
    Pick<TranscriptTurn, "speaker" | "text">[]
  >([]);
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false); // kept for green banner
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const reconnectedPromptTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);

  useEffect(() => {
    const container = transcriptContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [transcript]);

  // Fetch candidate info
  useEffect(() => {
    if (!token) return;
    setCandidateError(null);
    sessionsApi
      .getCandidateInfo(token)
      .then((res) => {
        setCandidateInfo(res.data);
        setSessionId(res.data.session_id);
        if (res.data.session_status === "ended") {
          setInterviewState("complete");
        } else if (!res.data.consent.accepted) {
          // Nothing runs — hardware checks included — until consent is recorded.
          setInterviewState("consent");
        }
      })
      .catch((error: unknown) => {
        // A missing or expired invite must never look like a finished interview.
        setCandidateError(
          httpStatus(error) === 404 ? "invalid" : "unavailable",
        );
      });
  }, [token, retryCount]);

  const acceptConsent = useCallback(async () => {
    if (!token || !candidateInfo) return;
    setConsentBusy(true);
    setConsentError(null);
    try {
      const res = await sessionsApi.acceptConsent(
        token,
        candidateInfo.consent.version,
      );
      setCandidateInfo((prev) =>
        prev ? { ...prev, consent: res.data.consent } : prev,
      );
      setInterviewState("idle");
    } catch {
      setConsentError(
        "We could not record your consent. Check your connection and try again.",
      );
    } finally {
      setConsentBusy(false);
    }
  }, [token, candidateInfo]);

  const declineConsent = useCallback(async () => {
    if (!token || !candidateInfo) return;
    setConsentBusy(true);
    setConsentError(null);
    try {
      const res = await sessionsApi.declineConsent(
        token,
        candidateInfo.consent.version,
      );
      setCandidateInfo((prev) =>
        prev ? { ...prev, consent: res.data.consent } : prev,
      );
    } catch {
      setConsentError(
        "We could not record your decision. Check your connection and try again.",
      );
    } finally {
      setConsentBusy(false);
    }
  }, [token, candidateInfo]);

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
      if (state === "active" && !micMutedRef.current) unmuteRef.current?.();
    }
  }, []);

  const handleReconnected = useCallback(() => {
    if (reconnectedPromptTimerRef.current)
      clearTimeout(reconnectedPromptTimerRef.current);
    setReconnectedPrompt(true);
    reconnectedPromptTimerRef.current = setTimeout(
      () => setReconnectedPrompt(false),
      10_000,
    );
  }, []);

  const handleTranscript = useCallback(
    (turn: Pick<TranscriptTurn, "speaker" | "text">) => {
      setTranscript((prev) => [...prev.slice(-9), turn]); // keep last 10
    },
    [],
  );

  const {
    playChunk,
    stop: stopPlayback,
    scheduleAfterPlayback,
    waitForDrain,
    cancelDrain,
  } = useAudioPlayback();
  const audioCompleteCalledRef = useRef(false);
  const audioCompleteSafetyTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

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

  const { connect, send, sendJson, disconnect, connectionState } =
    useAudioWebSocket({
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
    connect();
    await startCapture();
    // Start muted — only unmute when backend sends speaker_changed: candidate.
    // This prevents mic audio from being sent during AI speech, since separate
    // AudioContexts for capture/playback break the browser's echo cancellation.
    muteRef.current?.();
  }, [sessionId, connect, startCapture]);

  const endInterview = useCallback(async () => {
    setInterviewState("ending");
    if (reconnectedPromptTimerRef.current)
      clearTimeout(reconnectedPromptTimerRef.current);
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

  // ── State E2: Invite cannot be loaded ───────────────────────────────────
  if (candidateError) {
    const isInvalid = candidateError === "invalid";

    return (
      <div className="max-w-xl mx-auto px-4 py-16 space-y-4 text-center">
        <h1 className="text-xl font-semibold">
          {isInvalid
            ? "This invitation link is not valid"
            : "We could not load your interview"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isInvalid
            ? "The link may have expired or been copied incorrectly. Ask the hiring team for a new invitation link."
            : "Your interview has not started and nothing has been recorded. Check your connection and try again."}
        </p>
        {!isInvalid && (
          <Button
            className="w-full sm:w-auto"
            onClick={() => setRetryCount((count) => count + 1)}
          >
            Try again
          </Button>
        )}
      </div>
    );
  }

  // ── State D0: Consent gate ──────────────────────────────────────────────
  if (interviewState === "consent" && candidateInfo) {
    return (
      <ConsentGate
        roleTitle={candidateInfo.role_title}
        timeLimitMin={candidateInfo.time_limit_min}
        consent={candidateInfo.consent}
        busy={consentBusy}
        errorMessage={consentError}
        onAccept={acceptConsent}
        onDecline={declineConsent}
      />
    );
  }

  // ── State A: Pre-start ──────────────────────────────────────────────────
  if (interviewState === "idle") {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold">
            {candidateInfo?.role_title ?? "AI Interview"}
          </h1>
          {candidateInfo && (
            <p className="text-sm text-muted-foreground">
              {candidateInfo.time_limit_min} minutes
            </p>
          )}
        </div>

        {!hardwareCheckDone ? (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1.5 text-muted-foreground">
              <p>
                • This is a voice interview. Make sure you're in a quiet place.
              </p>
              <p>
                • The AI will ask follow-up questions — there are no scripts.
              </p>
              <p>
                • The session will last up to{" "}
                {candidateInfo?.time_limit_min ?? "—"} minutes.
              </p>
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
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
              <CheckCircle className="h-4 w-4 shrink-0" />
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

  // ── State F: Complete ───────────────────────────────────────────────────
  if (interviewState === "complete") {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-16">
        <Card className="w-full max-w-2xl overflow-hidden rounded-3xl border-primary/15 shadow-xl">
          <div className="h-2 bg-primary" />
          <CardContent className="p-6 text-center sm:p-10">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <Badge variant="outline" className="mt-6 border-primary/20 bg-primary/5 text-primary">
              Interview recorded
            </Badge>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Interview Complete</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-muted-foreground">
              Thank you for sharing your experience. Your interview has been securely recorded and the hiring team will review it.
            </p>

            <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> Session status</div>
                <p className="mt-2 font-medium">Successfully submitted</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"><Clock3 className="h-4 w-4 text-primary" /> Interview length</div>
                <p className="mt-2 font-medium">{candidateInfo?.time_limit_min ? `Up to ${candidateInfo.time_limit_min} minutes` : "Session complete"}</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-primary/5 p-5 text-left">
              <p className="font-medium">What happens next?</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">The hiring team will review your responses and follow up with you directly about next steps.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── States B/C/D/E: Active interview ────────────────────────────────────
  const aiSpeaking = speaker === "ai";
  const candidateSpeaking = speaker === "candidate";

  return (
    <div className="mx-auto flex h-dvh min-h-0 w-full max-w-xl flex-col overflow-hidden px-4">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between border-b bg-white py-3">
        <span className="text-sm font-medium">AI Interview</span>
        {candidateInfo && (
          <InterviewTimer
            totalSeconds={candidateInfo.time_limit_min * 60}
            running={interviewState === "active"}
            onExpired={endInterview}
          />
        )}
      </div>

      {/* Reconnecting banner */}
      {interviewState === "reconnecting" &&
        (connectionLostLong ? (
          <div className="flex shrink-0 items-center gap-2 text-sm bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-2.5 mt-2">
            <span className="animate-pulse">●</span>
            <span>
              Connection is taking too long to restore. Please wait, and contact
              the interviewer if this persists.
            </span>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2 text-sm bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-4 py-2.5 mt-2">
            <span className="animate-pulse">●</span>
            <span>Briefly reconnecting — please wait a moment.</span>
          </div>
        ))}

      {/* Reconnected prompt */}
      {reconnectedPrompt && (
        <div className="flex shrink-0 items-center justify-between text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-2.5 mt-2">
          <span>
            Reconnected — please say <strong>"check"</strong> or continue your
            answer to resume.
          </span>
          <button
            type="button"
            aria-label="Dismiss reconnection notice"
            className="ml-3 text-blue-500 hover:text-blue-700 shrink-0"
            onClick={() => setReconnectedPrompt(false)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Voice indicators use a stable height; only transcript scrolls. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 py-4">
        <div className="flex h-40 shrink-0 flex-col items-center justify-center gap-4">
          {interviewState === "connecting" ? (
            <div className="animate-pulse text-sm text-muted-foreground">
              Connecting...
            </div>
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
            </>
          )}
        </div>

        {/* This area consumes remaining space without expanding the page. */}
        <div
          ref={transcriptContainerRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="space-y-2">
            {transcript.map((turn, i) => (
              <TranscriptBubble
                key={i}
                speaker={turn.speaker}
                text={turn.text}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-t bg-white py-3">
        <ConnectionStatus state={wsConnectionStatus} />

        <div className="flex items-center gap-3">
          <Button
            variant={micMuted ? "destructive" : "outline"}
            size="sm"
            onClick={toggleMic}
          >
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
              <Button variant="outline" size="sm">
                End Interview
              </Button>
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
                <AlertDialogAction onClick={endInterview}>
                  End interview
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {import.meta.env.DEV && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs opacity-50"
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
