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
import { Skeleton } from "@/components/ui/skeleton";
import VoiceBars from "@/components/interview/VoiceBars";
import InterviewTimer from "@/components/interview/InterviewTimer";
import ConnectionStatus from "@/components/interview/ConnectionStatus";
import TranscriptBubble from "@/components/interview/TranscriptBubble";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";
import { sessionsApi } from "@/services/sessions";
import HardwareCheck from "@/components/HardwareCheck";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Mic,
  MicOff,
  PartyPopper,
  Volume2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";

function InterviewPageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex-1 w-full px-4 sm:px-6 py-6 sm:py-8",
        className
      )}
    >
      {children}
    </div>
  );
}

function StatusCard({
  icon,
  title,
  description,
  action,
  variant = "default",
}: {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  variant?: "default" | "success" | "error";
}) {
  return (
    <InterviewPageShell className="flex items-center justify-center py-10 sm:py-16">
      <div
        className={cn(
          "w-full max-w-md rounded-2xl border bg-white p-6 sm:p-8 text-center shadow-sm shadow-black/[0.04]",
          variant === "error" && "border-destructive/25",
          variant === "success" && "border-success/25"
        )}
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-muted">
          {icon}
        </div>
        <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{description}</p>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </InterviewPageShell>
  );
}

function SessionBanner({
  tone,
  children,
  onDismiss,
}: {
  tone: "warning" | "error" | "info";
  children: ReactNode;
  onDismiss?: () => void;
}) {
  const styles = {
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    error: "bg-destructive/5 border-destructive/25 text-destructive",
    info: "bg-primary-muted border-primary/20 text-foreground",
  };

  return (
    <div
      className={cn(
        "flex items-start gap-2 text-sm border rounded-xl px-3.5 py-3 sm:px-4",
        styles[tone]
      )}
      role="status"
    >
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current animate-pulse" aria-hidden />
      <div className="flex-1 min-w-0 leading-snug">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<Pick<TranscriptTurn, "speaker" | "text">[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [endedBeforeStart, setEndedBeforeStart] = useState(false);
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false);
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const reconnectedPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    setInfoLoading(true);
    setLoadError(null);
    sessionsApi
      .getCandidateInfo(token)
      .then((res) => {
        setCandidateInfo(res.data);
        setSessionId(res.data.session_id);
        if (res.data.session_status === "ended") {
          setEndedBeforeStart(true);
          setInterviewState("complete");
        }
      })
      .catch((err) => {
        const status = err.response?.status;
        if (status === 404) {
          setLoadError(
            "Link undangan tidak valid atau sudah kedaluwarsa. Hubungi tim rekrutmen untuk link baru."
          );
        } else {
          setLoadError(
            "Tidak dapat memuat sesi wawancara. Periksa koneksi Anda dan coba lagi."
          );
        }
      })
      .finally(() => setInfoLoading(false));
  }, [token]);

  const muteRef = useRef<(() => void) | null>(null);
  const unmuteRef = useRef<(() => void) | null>(null);

  const { playChunk, stop: stopPlayback, scheduleAfterPlayback, waitForDrain, cancelDrain } =
    useAudioPlayback();
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
    const attempt = async (delay: number) => {
      try {
        await sessionsApi.audioComplete(token);
        setInterviewState("complete");
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 422) {
          setLoadError(
            "Wawancara belum siap diakhiri. Teruskan percakapan hingga interviewer menutup sesi."
          );
          audioCompleteCalledRef.current = false;
          return;
        }
        setTimeout(() => attempt(Math.min(delay * 2, 8000)), delay);
      }
    };
    attempt(2000);
  }, [token, cancelDrain]);

  const handleStateChange = useCallback(
    (state: InterviewState) => {
      setInterviewState(state);

      if (state === "draining_audio") {
        muteRef.current?.();
        audioCompleteCalledRef.current = false;
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
    [callAudioComplete, waitForDrain]
  );

  const handleReconnected = useCallback(() => {
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    setReconnectedPrompt(true);
    reconnectedPromptTimerRef.current = setTimeout(() => setReconnectedPrompt(false), 10_000);
  }, []);

  const handleTranscript = useCallback((turn: Pick<TranscriptTurn, "speaker" | "text">) => {
    setTranscript((prev) => [...prev.slice(-9), turn]);
  }, []);

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
    [scheduleAfterPlayback]
  );

  const handleConnectionFailed = useCallback((message: string) => {
    setConnectionError(message);
  }, []);

  const { connect, send, sendJson, disconnect, connectionState } = useAudioWebSocket({
    sessionId: sessionId ?? 0,
    token,
    onAudioChunk: playChunk,
    onTranscript: handleTranscript,
    onStateChange: handleStateChange,
    onSpeakerChange: handleSpeakerChange,
    onReconnected: handleReconnected,
    onConnectionFailed: handleConnectionFailed,
  });

  const { start: startCapture, stop: stopCapture, mute, unmute } = useAudioCapture({
    onFrame: send,
  });

  useEffect(() => {
    if (interviewState !== "connection_failed") return;
    stopCapture();
    stopPlayback();
    disconnect();
  }, [interviewState, stopCapture, stopPlayback, disconnect]);

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
    muteRef.current?.();
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

  if (infoLoading) {
    return (
      <InterviewPageShell className="space-y-6" aria-busy="true">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
          Loading interview session…
        </div>
        <Skeleton className="h-8 w-3/4 max-w-xs rounded-lg" />
        <Skeleton className="h-4 w-32 rounded-md" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </InterviewPageShell>
    );
  }

  if (loadError) {
    return (
      <StatusCard
        variant="error"
        icon={<AlertCircle className="h-6 w-6 text-destructive" aria-hidden />}
        title="Tidak dapat melanjutkan"
        description={loadError}
      />
    );
  }

  if (interviewState === "idle") {
    const tips = [
      "This is a voice interview — find a quiet place with a stable connection.",
      "The AI asks follow-up questions; answer naturally in your own words.",
      `Session length is up to ${candidateInfo?.time_limit_min ?? "—"} minutes.`,
      "Your microphone stays active. You may end the interview at any time.",
    ];

    return (
      <InterviewPageShell className="space-y-6 sm:space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight px-2">
            {candidateInfo?.role_title ?? "AI Interview"}
          </h1>
          {candidateInfo && (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground rounded-full border border-border bg-white px-3 py-1">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {candidateInfo.time_limit_min} minutes
            </span>
          )}
        </div>

        {!hardwareCheckDone ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-white p-4 sm:p-5 shadow-sm shadow-black/[0.03]">
              <div className="flex items-center gap-2 mb-3">
                <Volume2 className="h-4 w-4 text-primary shrink-0" aria-hidden />
                <p className="text-sm font-medium text-foreground">Before you begin</p>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {tips.map((tip) => (
                  <li key={tip} className="flex gap-2 leading-relaxed">
                    <span className="text-primary shrink-0">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
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
            <div className="flex items-start gap-2.5 text-sm text-success bg-success-muted border border-success/20 rounded-xl px-4 py-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
              <span>Hardware checks passed. You&apos;re ready to start.</span>
            </div>
            <Button className="w-full h-11 font-medium" size="lg" onClick={startInterview}>
              <Mic className="h-4 w-4" aria-hidden />
              Start Interview
            </Button>
          </div>
        )}
      </InterviewPageShell>
    );
  }

  if (interviewState === "connection_failed") {
    return (
      <StatusCard
        variant="error"
        icon={<AlertCircle className="h-6 w-6 text-destructive" aria-hidden />}
        title="Tidak dapat memulai wawancara"
        description={
          <>
            <span className="block">{connectionError}</span>
            <span className="block mt-3 text-xs">
              Pastikan server API berjalan dan konfigurasi Gemini di backend sudah benar.
            </span>
          </>
        }
        action={
          <Button
            className="w-full sm:w-auto"
            onClick={() => {
              if (!token) return;
              setConnectionError(null);
              sessionsApi
                .getCandidateInfo(token)
                .then((res) => {
                  setCandidateInfo(res.data);
                  setSessionId(res.data.session_id);
                  if (res.data.session_status === "ended") {
                    setEndedBeforeStart(true);
                    setInterviewState("complete");
                    return;
                  }
                  setEndedBeforeStart(false);
                  setInterviewState("idle");
                  setHardwareCheckDone(false);
                })
                .catch(() => {
                  setLoadError("Tidak dapat memuat sesi. Muat ulang halaman.");
                });
            }}
          >
            Coba lagi
          </Button>
        }
      />
    );
  }

  if (interviewState === "complete") {
    if (endedBeforeStart) {
      const errored = candidateInfo?.end_reason === "error";
      return (
        <StatusCard
          variant={errored ? "error" : "default"}
          icon={
            <AlertCircle
              className={cn("h-6 w-6", errored ? "text-destructive" : "text-primary")}
              aria-hidden
            />
          }
          title={errored ? "Sesi tidak sempat dimulai" : "Sesi wawancara sudah selesai"}
          description={
            errored
              ? "Koneksi ke AI interviewer gagal sebelum wawancara berjalan. Minta tim rekrutmen membuat undangan sesi baru, lalu buka link yang baru."
              : "Link undangan ini sudah dipakai. Jika Anda perlu wawancara ulang, minta link undangan baru dari tim rekrutmen."
          }
        />
      );
    }

    return (
      <StatusCard
        variant="success"
        icon={<PartyPopper className="h-6 w-6 text-primary" aria-hidden />}
        title="Interview complete"
        description={
          <>
            Thank you — your interview has been recorded.
            <span className="block mt-2">
              The hiring team will review your results and follow up with you.
            </span>
          </>
        }
      />
    );
  }

  const aiSpeaking = speaker === "ai";
  const candidateSpeaking = speaker === "candidate";

  return (
    <div className="flex flex-col flex-1 min-h-[calc(100dvh-3.5rem)] w-full">
      <div className="sticky top-14 z-10 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate min-w-0">
            {candidateInfo?.role_title ?? "AI Interview"}
          </p>
          {candidateInfo && (
            <InterviewTimer
              totalSeconds={candidateInfo.time_limit_min * 60}
              running={interviewState === "active"}
              onExpired={endInterview}
            />
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 px-4 sm:px-6 py-3 sm:py-4 gap-3 overflow-hidden">
        {interviewState === "reconnecting" &&
          (connectionLostLong ? (
            <SessionBanner tone="error">
              Connection is taking too long to restore. Please wait, and contact the interviewer
              if this persists.
            </SessionBanner>
          ) : (
            <SessionBanner tone="warning">
              Briefly reconnecting — please wait a moment.
            </SessionBanner>
          ))}

        {reconnectedPrompt && (
          <SessionBanner tone="info" onDismiss={() => setReconnectedPrompt(false)}>
            Reconnected — please say <strong>&quot;check&quot;</strong> or continue your answer to
            resume.
          </SessionBanner>
        )}

        <div className="flex-1 flex flex-col items-center justify-center gap-5 sm:gap-6 min-h-0 py-2">
          {interviewState === "connecting" ? (
            <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
              <span>Connecting to AI interviewer…</span>
            </div>
          ) : interviewState === "draining_audio" ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <VoiceBars active label="AI speaking" variant="ai" />
              <p className="text-xs text-muted-foreground">Wrapping up…</p>
            </div>
          ) : (
            <>
              <VoiceBars
                active={aiSpeaking}
                label={aiSpeaking ? "AI speaking" : "Listening…"}
                variant="ai"
              />

              {candidateSpeaking && (
                <VoiceBars active label="You're speaking" variant="candidate" />
              )}

              {transcript.length > 0 && (
                <div className="w-full flex-1 min-h-0 overflow-y-auto space-y-2.5 pt-2 max-h-[42vh] sm:max-h-[50vh]">
                  {transcript.map((turn, i) => (
                    <TranscriptBubble key={i} speaker={turn.speaker} text={turn.text} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-white px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ConnectionStatus state={wsConnectionStatus} className="self-start sm:self-center" />

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              variant={micMuted ? "destructive" : "outline"}
              size="sm"
              onClick={toggleMic}
              className="flex-1 sm:flex-none min-h-10"
            >
              {micMuted ? (
                <>
                  <MicOff className="h-4 w-4" aria-hidden />
                  <span>Muted</span>
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" aria-hidden />
                  <span className="sm:inline">Mic on</span>
                </>
              )}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none min-h-10">
                  End interview
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg rounded-xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>End interview?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to end the interview early?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
                  <AlertDialogCancel className="mt-0">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={endInterview}>End interview</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {import.meta.env.DEV && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs opacity-60 w-full sm:w-auto"
                onClick={() => sendJson({ type: "debug_force_reconnect" })}
              >
                Force reconnect
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
