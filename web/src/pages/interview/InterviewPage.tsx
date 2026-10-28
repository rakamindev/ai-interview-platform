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
import type {
  CandidateInfo,
  InterviewState,
  InterviewSpeaker,
  TranscriptTurn,
} from "@/types";

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<
    Pick<TranscriptTurn, "speaker" | "text">[]
  >([]);
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false);
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const reconnectedPromptTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionLostTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);

  useEffect(() => {
    if (!token) return;

    sessionsApi
      .getCandidateInfo(token)
      .then((res) => {
        setCandidateInfo(res.data);
        setSessionId(res.data.session_id);
        if (res.data.session_status === "ended") {
          setInterviewState("complete");
        }
      })
      .catch(() => setInterviewState("complete"));
  }, [token]);

  const muteRef = useRef<(() => void) | null>(null);
  const unmuteRef = useRef<(() => void) | null>(null);

  const handleStateChange = useCallback((state: InterviewState) => {
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

      if (state === "active" && !micMutedRef.current) {
        unmuteRef.current?.();
      }
    }
  }, []);

  const handleReconnected = useCallback(() => {
    if (reconnectedPromptTimerRef.current) {
      clearTimeout(reconnectedPromptTimerRef.current);
    }

    setReconnectedPrompt(true);
    reconnectedPromptTimerRef.current = setTimeout(
      () => setReconnectedPrompt(false),
      10_000,
    );
  }, []);

  const handleTranscript = useCallback(
    (turn: Pick<TranscriptTurn, "speaker" | "text">) => {
      setTranscript((prev) => [...prev.slice(-9), turn]);
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
  const audioCompleteSafetyTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

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
    muteRef.current?.();
  }, [sessionId, connect, startCapture]);

  const endInterview = useCallback(async () => {
    setInterviewState("ending");

    if (reconnectedPromptTimerRef.current) {
      clearTimeout(reconnectedPromptTimerRef.current);
    }

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

  if (interviewState === "idle") {
    return (
      <main className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-8 space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {candidateInfo?.role_title ?? "AI Interview"}
            </h1>

            {candidateInfo && (
              <p className="text-sm text-muted-foreground">
                {candidateInfo.time_limit_min} minutes
              </p>
            )}
          </div>

          {!hardwareCheckDone ? (
            <div className="space-y-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
              <div className="space-y-3 rounded-xl bg-muted/50 p-5 text-sm leading-6 text-muted-foreground sm:p-6">
                <p>
                  • This is a voice interview. Make sure you're in a quiet
                  place.
                </p>
                <p>
                  • The AI will ask follow-up questions — there are no scripts.
                </p>
                <p>
                  • The session will last up to{" "}
                  {candidateInfo?.time_limit_min ?? "—"} minutes.
                </p>
                <p>
                  • Your mic will be active throughout. You can end anytime.
                </p>
              </div>

              <HardwareCheck
                onStart={() => {
                  setHardwareCheckDone(true);
                  startInterview();
                }}
              />
            </div>
          ) : (
            <div className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
              <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                <CheckCircle className="h-5 w-5 shrink-0" />
                <span>Hardware checks passed. You're ready to start.</span>
              </div>

              <Button
                className="h-12 w-full"
                size="lg"
                onClick={startInterview}
              >
                <Mic className="mr-2 h-4 w-4" />
                Start Interview
              </Button>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (interviewState === "complete") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
        <div className="w-full max-w-xl space-y-4 rounded-2xl border bg-card px-6 py-12 text-center shadow-sm sm:px-10">
          <div className="text-4xl">✅</div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Interview Complete
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Thank you. The interview has been recorded.
            <br />
            The hiring team will review your results and follow up with you.
          </p>
        </div>
      </main>
    );
  }

  const aiSpeaking = speaker === "ai";
  const candidateSpeaking = speaker === "candidate";

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 sm:px-6 lg:px-8">
        {/* Top bar */}
        <header className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-4 border-b bg-background/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <span className="text-sm font-semibold tracking-tight sm:text-base">
            AI Interview
          </span>

          {candidateInfo && (
            <InterviewTimer
              totalSeconds={candidateInfo.time_limit_min * 60}
              running={interviewState === "active"}
              onExpired={endInterview}
            />
          )}
        </header>

        {/* Connection notices */}
        <div className="mx-auto w-full max-w-3xl space-y-3">
          {interviewState === "reconnecting" &&
            (connectionLostLong ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800">
                <span className="animate-pulse">●</span>
                <span>
                  Connection is taking too long to restore. Please wait, and
                  contact the interviewer if this persists.
                </span>
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm leading-5 text-yellow-800">
                <span className="animate-pulse">●</span>
                <span>Briefly reconnecting — please wait a moment.</span>
              </div>
            ))}

          {reconnectedPrompt && (
            <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-5 text-blue-800">
              <span>
                Reconnected — please say <strong>"check"</strong> or continue
                your answer to resume.
              </span>
              <button
                className="shrink-0 rounded-md px-1 text-blue-500 hover:text-blue-700"
                onClick={() => setReconnectedPrompt(false)}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Interview area */}
        <section className="flex flex-1 flex-col py-6 sm:py-8">
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
            {interviewState === "connecting" ? (
              <div className="flex flex-1 items-center justify-center py-16">
                <p className="animate-pulse text-sm text-muted-foreground">
                  Connecting...
                </p>
              </div>
            ) : interviewState === "draining_audio" ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
                <VoiceBars active={true} label="AI speaking" variant="ai" />
                <p className="text-sm text-muted-foreground">Wrapping up...</p>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-8 py-8 sm:gap-10 sm:py-10">
                <div className="flex min-h-36 w-full items-center justify-center sm:min-h-44">
                  <VoiceBars
                    active={aiSpeaking}
                    label={aiSpeaking ? "AI speaking" : "Listening..."}
                    variant="ai"
                  />
                </div>

                {candidateSpeaking && (
                  <VoiceBars
                    active={true}
                    label="You're speaking"
                    variant="candidate"
                  />
                )}

                {transcript.length > 0 && (
                  <div className="max-h-[42vh] w-full space-y-3 overflow-y-auto rounded-2xl border bg-card p-4 shadow-sm sm:max-h-[48vh] sm:p-6">
                    {transcript.map((turn, i) => (
                      <TranscriptBubble
                        key={i}
                        speaker={turn.speaker}
                        text={turn.text}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Bottom controls */}
        <footer className="sticky bottom-0 z-20 -mx-4 border-t bg-background/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3">
            <ConnectionStatus state={wsConnectionStatus} />

            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <Button
                variant={micMuted ? "destructive" : "outline"}
                size="sm"
                onClick={toggleMic}
              >
                {micMuted ? (
                  <>
                    <MicOff className="mr-1.5 h-3.5 w-3.5" />
                    Muted
                  </>
                ) : (
                  <>
                    <Mic className="mr-1.5 h-3.5 w-3.5" />
                    Mic On
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
                  onClick={() =>
                    sendJson({ type: "debug_force_reconnect" })
                  }
                >
                  ⚡ Force reconnect
                </Button>
              )}
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}