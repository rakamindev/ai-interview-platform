import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { CheckCircle, Mic, MicOff } from "lucide-react";

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
import type {
  CandidateInfo,
  InterviewState,
  InterviewSpeaker,
  TranscriptTurn,
} from "@/types";
import useUserRole from "@/hooks/useUserRole";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const { isUser } = useUserRole();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(
    null,
  );
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState | null>(
    null,
  );
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
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState(false);

  const { formState, register, handleSubmit, watch } = useForm<{
    email: string;
  }>({
    defaultValues: {
      email: "",
    },
  });
  const { errors } = formState;
  const email = watch("email");

  // Fetch candidate info
  useEffect(() => {
    if (!token) return;
    sessionsApi
      .getCandidateInfo(token)
      .then((res) => {
        setCandidateInfo(res.data);
        setSessionId(res.data.session_id);
        setInterviewState("idle");
        if (res.data.session_status === "ended") setInterviewState("complete");
      })
      .catch(() => setError(true));
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
      setIsStale(false);
      setTranscript((prev) => {
        const lastTurn = prev[prev.length - 1];

        // If the last turn is from the same speaker, append the text
        if (lastTurn && lastTurn.speaker === turn.speaker) {
          const updatedPrev = [...prev];
          updatedPrev[updatedPrev.length - 1] = {
            ...lastTurn,
            text: lastTurn.text + turn.text + " ",
          };
          return updatedPrev.slice(-9); // keep last 10
        } else {
          // Different speaker, create a new turn
          return [...prev.slice(-9), turn]; // keep last 10
        }
      });
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
        setIsStale(true);
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
    // Send email via WebSocket if provided (must be sent after connection is established)
    if (email) {
      sendJson({ type: "email", token: email });
    }
    // Start muted — only unmute when backend sends speaker_changed: candidate.
    // This prevents mic audio from being sent during AI speech, since separate
    // AudioContexts for capture/playback break the browser's echo cancellation.
    muteRef.current?.();
  }, [sessionId, connect, startCapture, email, sendJson]);

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

  // ── Error state ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-xl font-semibold">Interview Not Found</h2>
        <p className="text-sm text-muted-foreground">
          The interview link is invalid or has expired.
          <br />
          Please contact the hiring team for a new link.
        </p>
      </div>
    );
  }

  if (!interviewState) return null;

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

        {hardwareCheckDone ? (
          // @todo: this section is unreachable?
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
        ) : (
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
            {!isUser && (
              <div className="space-y-1.5">
                <Label htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  placeholder="Email"
                  type="email"
                  {...register("email", {
                    required: "Email is required for non authenticated user",
                  })}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>
            )}

            <HardwareCheck
              onStart={handleSubmit(() => {
                setHardwareCheckDone(true);
                startInterview();
              })}
            />
          </div>
        )}
      </div>
    );
  }

  // ── State F: Complete ───────────────────────────────────────────────────
  if (interviewState === "complete") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="text-4xl">✅</div>
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
          <div className="flex items-center gap-2 text-sm bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-2.5 mt-2">
            <span className="animate-pulse">●</span>
            <span>
              Connection is taking too long to restore. Please wait, and contact
              the interviewer if this persists.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-4 py-2.5 mt-2">
            <span className="animate-pulse">●</span>
            <span>Briefly reconnecting — please wait a moment.</span>
          </div>
        ))}

      {/* Reconnected prompt */}
      {reconnectedPrompt && (
        <div className="flex items-center justify-between text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-2.5 mt-2">
          <span>
            Reconnected — please say <strong>"check"</strong> or continue your
            answer to resume.
          </span>
          <button
            className="ml-3 text-blue-500 hover:text-blue-700 shrink-0"
            onClick={() => setReconnectedPrompt(false)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Voice indicator */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
        {interviewState === "connecting" ? (
          <div className="text-sm text-muted-foreground animate-pulse">
            Connecting...
          </div>
        ) : interviewState === "draining_audio" ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <VoiceBars active={true} label="AI speaking" variant="ai" />
            <p className="text-xs text-muted-foreground">Wrapping up...</p>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
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
            </div>

            {/* Transcript */}
            {transcript.length > 0 && (
              <div className="w-full space-y-2 overflow-y-auto max-h-[60vh]">
                {transcript.map((turn, i) => (
                  <TranscriptBubble
                    key={i}
                    speaker={turn.speaker}
                    text={turn.text}
                  />
                ))}
              </div>
            )}

            {candidateSpeaking && (
              <div className="w-full">
                <TranscriptBubble
                  speaker={speaker}
                  text="You're speaking..."
                  isLive={true}
                />
              </div>
            )}

            {/* 
              transcript sent by bulk, need show intermediary loading indicator. 
              @todo: work in progress to sent chat in chunk, but result isn't good enough 
            */}
            {aiSpeaking && transcript.length !== 0 && isStale && (
              <div className="w-full rounded-lg px-3 py-4 text-sm bg-muted text-foreground animate-pulse border-2 border-primary/30">
                <span className="ml-1 animate-pulse">● ● ●</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div className="border-t py-3 flex items-center justify-between gap-4 sticky bottom-0 bg-white">
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
