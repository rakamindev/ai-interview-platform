import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
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
import VoiceOrb, { type VoiceOrbMode } from "@/components/interview/VoiceOrb";
import InterviewTimer from "@/components/interview/InterviewTimer";
import ConnectionStatus from "@/components/interview/ConnectionStatus";
import TranscriptBubble from "@/components/interview/TranscriptBubble";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";
import { sessionsApi } from "@/services/sessions";
import { getApiErrorStatus } from "@/lib/apiError";
import HardwareCheck from "@/components/HardwareCheck";
import { getInterviewClientId } from "@/utils/interviewClientId";
import Notice from "@/components/Notice";
import { Card } from "@/components/ui/card";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Link2Off,
  Loader2,
  Lock,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  ServerCrash,
  WifiOff,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";

// audio_complete retries: 2s, 4s, 8s, 8s between five attempts (~22s), then give up.
const AUDIO_COMPLETE_MAX_ATTEMPTS = 5;

type LoadStatus = "loading" | "ready" | "invalid" | "error";

const STATUS_TONES = {
  neutral: "bg-rakamin-light-cyan text-primary",
  success: "bg-green-50 text-green-700",
  error: "bg-destructive/10 text-destructive",
};

// Full-page message shown before or after the interview itself.
function StatusScreen({
  icon: Icon,
  tone,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  tone: keyof typeof STATUS_TONES;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12 sm:py-16">
      <Card className="flex flex-col items-center gap-4 px-6 py-10 text-center">
        <span
          className={`flex h-14 w-14 items-center justify-center rounded-full ${STATUS_TONES[tone]}`}
        >
          <Icon className="h-6 w-6" />
        </span>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <div className="space-y-1 text-sm text-muted-foreground">{children}</div>
        {action}
      </Card>
    </div>
  );
}

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [micError, setMicError] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<Pick<TranscriptTurn, "speaker" | "text">[]>([]);
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false); // kept for green banner
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const [sessionFailed, setSessionFailed] = useState(false);
  const [inUseElsewhere, setInUseElsewhere] = useState(false);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [connectionReplaced, setConnectionReplaced] = useState(false);
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const [clientId] = useState(getInterviewClientId);
  const reconnectedPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const micMutedRef = useRef(false);

  // Fetch candidate info. A failure must never look like a finished interview.
  const loadCandidateInfo = useCallback(() => {
    if (!token) {
      setLoadStatus("invalid");
      return;
    }
    setLoadStatus("loading");
    sessionsApi
      .getCandidateInfo(token, clientId)
      .then((res) => {
        setCandidateInfo(res.data);
        setSessionId(res.data.session_id);
        // A rejoining candidate continues against the time the server has already counted.
        if (res.data.remaining_seconds != null) {
          setDeadlineMs(Date.now() + res.data.remaining_seconds * 1000);
        }
        setLoadStatus("ready");
        if (res.data.session_status === "ended") {
          // An interview cut short by an error must not look finished when the link is reopened.
          if (res.data.end_reason === "error") setSessionFailed(true);
          setInterviewState("complete");
        } else if (res.data.in_use_elsewhere) {
          setInUseElsewhere(true);
          setInterviewState("complete");
        }
      })
      .catch((requestError: unknown) =>
        setLoadStatus(getApiErrorStatus(requestError) === 404 ? "invalid" : "error"),
      );
  }, [token, clientId]);

  useEffect(() => {
    loadCandidateInfo();
  }, [loadCandidateInfo]);

  const muteRef = useRef<(() => void) | null>(null);
  const unmuteRef = useRef<(() => void) | null>(null);

  const {
    playChunk,
    stop: stopPlayback,
    scheduleAfterPlayback,
    waitForDrain,
    cancelDrain,
  } = useAudioPlayback();
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
    // Retry a bounded number of times — endpoint always returns ended:true or an error.
    // ended:false is no longer a valid response; any success means the session ended.
    const attempt = async (attemptNumber: number, delay: number) => {
      try {
        await sessionsApi.audioComplete(token);
      } catch {
        if (attemptNumber >= AUDIO_COMPLETE_MAX_ATTEMPTS) {
          // The end could not be recorded; tell the candidate instead of waiting forever.
          setSessionFailed(true);
          setInterviewState("complete");
          return;
        }
        setTimeout(() => attempt(attemptNumber + 1, Math.min(delay * 2, 8000)), delay);
      }
    };
    attempt(1, 2000);
  }, [token, cancelDrain]);

  const handleStateChange = useCallback(
    (state: InterviewState) => {
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
    },
    [callAudioComplete, waitForDrain],
  );

  const handleReconnected = useCallback(() => {
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    setReconnectedPrompt(true);
    reconnectedPromptTimerRef.current = setTimeout(() => setReconnectedPrompt(false), 10_000);
  }, []);

  const handleSessionFailed = useCallback((code?: string) => {
    // Another browser already started this interview (e.g. both clicked Start on a shared link).
    if (code === "session_in_use") setInUseElsewhere(true);
    // The server could not verify who owns this interview (its claim store is down).
    else if (code === "claim_unavailable") setServiceUnavailable(true);
    // Another tab took over, or the interviewer reset access for another device.
    else if (code === "connection_replaced") setConnectionReplaced(true);
    else setSessionFailed(true);
  }, []);

  // Keep the newest turn in view as the conversation grows.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript]);

  const handleTranscript = useCallback((turn: Pick<TranscriptTurn, "speaker" | "text">) => {
    setTranscript((prev) => [...prev.slice(-9), turn]); // keep last 10
  }, []);

  const handleTranscriptHistory = useCallback(
    (turns: Pick<TranscriptTurn, "speaker" | "text">[]) => setTranscript(turns),
    [],
  );

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
    clientId,
    onAudioChunk: playChunk,
    onTranscript: handleTranscript,
    onTranscriptHistory: handleTranscriptHistory,
    onStateChange: handleStateChange,
    onSpeakerChange: handleSpeakerChange,
    onReconnected: handleReconnected,
    onSessionFailed: handleSessionFailed,
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

  // A new interview's time starts when it goes live.
  const timeLimitMin = candidateInfo?.time_limit_min;
  useEffect(() => {
    if (interviewState !== "active" || timeLimitMin === undefined) return;
    setDeadlineMs((current) => current ?? Date.now() + timeLimitMin * 60_000);
  }, [interviewState, timeLimitMin]);

  // The mic and speaker have no purpose on an end screen, however the interview ended.
  useEffect(() => {
    if (interviewState !== "complete") return;
    stopCapture();
    stopPlayback();
  }, [interviewState, stopCapture, stopPlayback]);

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
    setMicError(false);
    setInterviewState("connecting");
    // Open the mic before connecting so a denied permission never starts the AI session.
    const captureStarted = await startCapture();
    if (!captureStarted) {
      setMicError(true);
      setInterviewState("idle");
      return;
    }
    // Start muted — only unmute when backend sends speaker_changed: candidate.
    // This prevents mic audio from being sent during AI speech, since separate
    // AudioContexts for capture/playback break the browser's echo cancellation.
    muteRef.current?.();
    connect();
  }, [sessionId, connect, startCapture]);

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

  // ── Invite link could not be loaded ─────────────────────────────────────
  if (loadStatus === "invalid") {
    return (
      <StatusScreen icon={Link2Off} tone="error" title="Interview Link Not Valid">
        <p>This interview link is invalid or has expired.</p>
        <p>Please check the link, or contact the interviewer for a new one.</p>
      </StatusScreen>
    );
  }

  if (loadStatus === "error") {
    return (
      <StatusScreen
        icon={WifiOff}
        tone="error"
        title="Couldn't Load Your Interview"
        action={
          <Button variant="outline" onClick={loadCandidateInfo}>
            <RefreshCw /> Try again
          </Button>
        }
      >
        <p>Check your internet connection and try again.</p>
      </StatusScreen>
    );
  }

  if (loadStatus === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        Loading your interview...
      </div>
    );
  }

  // ── State A: Pre-start ──────────────────────────────────────────────────
  if (interviewState === "idle") {
    return (
      <div className="mx-auto w-full max-w-xl space-y-6 px-4 py-8 sm:py-12">
        <div className="space-y-3 text-center">
          <span className="inline-flex items-center rounded-full bg-rakamin-light-cyan px-3 py-1 text-xs font-medium text-rakamin-dark-teal">
            Voice interview
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">
            {candidateInfo?.role_title ?? "AI Interview"}
          </h1>
          {candidateInfo && (
            <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" /> {candidateInfo.time_limit_min} minutes
            </p>
          )}
        </div>

        {!hardwareCheckDone ? (
          <div className="space-y-4">
            <ul className="space-y-2.5 rounded-2xl border bg-card p-5 text-sm shadow-sm">
              {[
                "This is a voice interview. Make sure you're in a quiet place.",
                "The AI will ask follow-up questions — there are no scripts.",
                `The session will last up to ${candidateInfo?.time_limit_min ?? "—"} minutes.`,
                "Your mic will be active throughout. You can end anytime.",
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2.5">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-rakamin-teal" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
            <HardwareCheck
              onStart={() => {
                setHardwareCheckDone(true);
                startInterview();
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {micError ? (
              <Notice variant="error">
                We couldn't access your microphone. Allow microphone access for this site in your
                browser settings, make sure a microphone is connected, then press Start Interview
                again.
              </Notice>
            ) : (
              <Notice variant="success">Hardware checks passed. You're ready to start.</Notice>
            )}
            <Button className="w-full" size="lg" onClick={startInterview}>
              <Mic />
              Start Interview
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── State F: Complete ───────────────────────────────────────────────────
  if (interviewState === "complete") {
    if (inUseElsewhere) {
      return (
        <StatusScreen icon={Lock} tone="neutral" title="Interview Already in Progress">
          <p>
            This interview link is already being used in another browser or on another device, and
            only one person can take the interview.
          </p>
          <p>
            If you are the candidate and lost access (for example after switching device or clearing
            your browser data), contact the interviewer right away. They can reset your access.
          </p>
        </StatusScreen>
      );
    }

    if (connectionReplaced) {
      return (
        <StatusScreen icon={Lock} tone="neutral" title="Interview Continued Elsewhere">
          <p>
            This interview moved to another tab or device, or the interviewer reset access, so it
            has stopped here.
          </p>
          <p>If this wasn't you, please contact the interviewer.</p>
        </StatusScreen>
      );
    }

    if (serviceUnavailable) {
      return (
        <StatusScreen
          icon={ServerCrash}
          tone="error"
          title="Interview Service Unavailable"
          action={
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw /> Try again
            </Button>
          }
        >
          <p>We couldn't connect you to your interview because our service is temporarily down.</p>
          <p>Please try again in a moment. If this keeps happening, contact the interviewer.</p>
        </StatusScreen>
      );
    }

    if (sessionFailed) {
      return (
        <StatusScreen icon={AlertTriangle} tone="error" title="Interview Could Not Continue">
          <p>A technical problem interrupted the interview and it couldn't be restored.</p>
          <p>Please contact the interviewer to arrange next steps.</p>
        </StatusScreen>
      );
    }

    return (
      <StatusScreen icon={CheckCircle} tone="success" title="Interview Complete">
        <p>Thank you. The interview has been recorded.</p>
        <p>The hiring team will review your results and follow up with you.</p>
      </StatusScreen>
    );
  }

  // ── States B/C/D/E: Active interview ────────────────────────────────────
  const orbMode: VoiceOrbMode =
    interviewState === "connecting"
      ? "connecting"
      : interviewState === "draining_audio"
        ? "wrapping"
        : interviewState === "reconnecting"
          ? "waiting"
          : speaker === "ai"
            ? "ai"
            : speaker === "candidate"
              ? micMuted
                ? "muted"
                : "candidate"
              : "waiting";

  return (
    <div className="mx-auto flex h-full w-full max-w-xl flex-col px-4">
      {/* Top bar */}
      <div className="sticky top-0 z-10 mt-4 flex items-center justify-between rounded-full border bg-card/90 px-4 py-2.5 shadow-sm backdrop-blur">
        <span className="text-sm font-medium">{candidateInfo?.role_title ?? "AI Interview"}</span>
        {candidateInfo && (
          <InterviewTimer
            totalSeconds={candidateInfo.time_limit_min * 60}
            deadlineMs={deadlineMs}
            running={interviewState === "active"}
            onExpired={endInterview}
          />
        )}
      </div>

      {/* Reconnecting banner */}
      {interviewState === "reconnecting" &&
        (connectionLostLong ? (
          <Notice variant="error" className="mt-3">
            Connection is taking too long to restore. Please wait, and contact the interviewer if
            this persists.
          </Notice>
        ) : (
          <Notice variant="warning" className="mt-3">
            Briefly reconnecting — please wait a moment.
          </Notice>
        ))}

      {/* Reconnected prompt */}
      {reconnectedPrompt && (
        <Notice
          variant="info"
          className="mt-3"
          action={
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Dismiss"
              onClick={() => setReconnectedPrompt(false)}
            >
              <X />
            </Button>
          }
        >
          Reconnected — please say <strong>"check"</strong> or continue your answer to resume.
        </Notice>
      )}

      {/* One voice at a time: the orb shows whose turn it is */}
      <div className="flex flex-col items-center py-10">
        <VoiceOrb mode={orbMode} />
      </div>

      {/* Transcript */}
      {transcript.length > 0 && (
        <section
          aria-label="Conversation"
          className="mb-6 rounded-3xl border bg-card/80 p-4 shadow-sm"
        >
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-rakamin-teal">
            Conversation
          </p>
          <div ref={transcriptRef} className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
            {transcript.map((turn, i) => (
              <TranscriptBubble key={i} speaker={turn.speaker} text={turn.text} />
            ))}
          </div>
        </section>
      )}

      {/* Control dock */}
      <div className="sticky bottom-4 mb-4 mt-auto flex items-center justify-between gap-3 rounded-full border bg-card/90 py-2.5 pl-4 pr-2.5 shadow-lg backdrop-blur">
        <ConnectionStatus state={wsConnectionStatus} />

        <div className="flex items-center gap-2">
          {import.meta.env.DEV && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => sendJson({ type: "debug_force_reconnect" })}
            >
              <Zap /> Force reconnect
            </Button>
          )}
          <Button
            variant={micMuted ? "destructive" : "outline"}
            size="icon"
            className="h-12 w-12"
            aria-label={micMuted ? "Unmute microphone" : "Mute microphone"}
            aria-pressed={micMuted}
            title={micMuted ? "Unmute microphone" : "Mute microphone"}
            onClick={toggleMic}
          >
            {micMuted ? <MicOff /> : <Mic />}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="icon"
                className="h-12 w-12"
                aria-label="End interview"
                title="End interview"
              >
                <PhoneOff />
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
                <AlertDialogAction onClick={endInterview}>End interview</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
