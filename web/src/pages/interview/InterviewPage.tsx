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
import { AlertCircle, CheckCircle, Mic, MicOff, RefreshCw } from "lucide-react";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [interviewError, setInterviewError] = useState<string | null>(null);
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<Pick<TranscriptTurn, "speaker" | "text">[]>([]);
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false); // kept for green banner
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [awaitingAiResponse, setAwaitingAiResponse] = useState(false);
  const reconnectedPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);
  const awaitingAiResponseRef = useRef(false);

  // Fetch candidate info
  useEffect(() => {
    if (!token) return;
    sessionsApi.getCandidateInfo(token)
      .then((res) => {
        setCandidateInfo(res.data);
        setSessionId(res.data.session_id);
        if (res.data.session_status === "ended") setInterviewState("complete");
      })
      .catch(() => {
        setInterviewError("This invite link is invalid or expired.");
        setInterviewState("failed");
      });
  }, [token]);

  const muteRef = useRef<(() => void) | null>(null);
  const unmuteRef = useRef<(() => void) | null>(null);

  const handleStateChange = useCallback((state: InterviewState) => {
    if (state === "active") setInterviewError(null);
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
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    setReconnectedPrompt(true);
    reconnectedPromptTimerRef.current = setTimeout(() => setReconnectedPrompt(false), 10_000);
  }, []);

  const handleConnectionError = useCallback((message: string) => {
    setInterviewError(message);
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

  const handleSpeakerChange = useCallback((newSpeaker: InterviewSpeaker) => {
    if (newSpeaker === "ai") {
      awaitingAiResponseRef.current = false;
      setAwaitingAiResponse(false);
      setSpeaker("ai");
      muteRef.current?.();
    } else if (newSpeaker === "candidate") {
      scheduleAfterPlayback(() => {
        awaitingAiResponseRef.current = false;
        setAwaitingAiResponse(false);
        setSpeaker("candidate");
        if (!micMutedRef.current) unmuteRef.current?.();
      });
    }
  }, [scheduleAfterPlayback]);

  const { connect, send, sendJson, disconnect, connectionState } = useAudioWebSocket({
    sessionId: sessionId ?? 0,
    token,
    onAudioChunk: playChunk,
    onTranscript: handleTranscript,
    onStateChange: handleStateChange,
    onSpeakerChange: handleSpeakerChange,
    onReconnected: handleReconnected,
    onError: handleConnectionError,
  });

  const { start: startCapture, stop: stopCapture, mute, unmute } = useAudioCapture({
    onFrame: (buffer) => {
      if (!awaitingAiResponseRef.current) send(buffer);
    },
    onLevel: setMicLevel,
  });

  muteRef.current = mute;
  unmuteRef.current = unmute;

  const toggleMic = useCallback(() => {
    if (micMutedRef.current) {
      micMutedRef.current = false;
      setMicMuted(false);
      awaitingAiResponseRef.current = false;
      setAwaitingAiResponse(false);
      unmute();
    } else {
      micMutedRef.current = true;
      setMicMuted(true);
      mute();
    }
  }, [mute, unmute]);

  const finishAnswer = useCallback(() => {
    awaitingAiResponseRef.current = true;
    setAwaitingAiResponse(true);
    sendJson({ type: "audio_stream_end" });
  }, [sendJson]);

  const startInterview = useCallback(async () => {
    if (!sessionId) return;
    setInterviewError(null);
    setInterviewState("connecting");
    connect();
    try {
      await startCapture();
    } catch {
      disconnect();
      setInterviewError("Microphone access could not be started. Check browser permissions and try again.");
      setInterviewState("failed");
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
    awaitingAiResponseRef.current = false;
    setAwaitingAiResponse(false);
    sendJson({ type: "end_session" });
    disconnect();
    setInterviewState("complete");
  }, [stopCapture, stopPlayback, sendJson, disconnect]);

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
            <HardwareCheck onStart={() => { setHardwareCheckDone(true); startInterview(); }} />
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
  if (interviewState === "failed") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold">Interview Could Not Start</h2>
        <p className="text-sm text-muted-foreground">
          {interviewError ?? "The interview connection failed. Please try again."}
        </p>
        {sessionId && (
          <Button className="mt-2" onClick={startInterview}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}
      </div>
    );
  }

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
  const canFinishAnswer = interviewState === "active" && speaker === "candidate" && !micMuted && !awaitingAiResponse;
  const visibleMicLevel = Math.min(100, Math.round(micLevel * 500));

  return (
    <div className="mx-auto flex h-[calc(100dvh-3rem)] min-h-0 w-full max-w-xl flex-col overflow-hidden px-3 sm:px-4">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b bg-white py-2.5 sm:py-3">
        <span className="min-w-0 truncate text-sm font-medium">
          {candidateInfo?.role_title ?? "AI Interview"}
        </span>
        {candidateInfo && (
          <div className="shrink-0">
            <InterviewTimer
              totalSeconds={candidateInfo.time_limit_min * 60}
              running={interviewState === "active"}
              onExpired={endInterview}
            />
          </div>
        )}
      </div>

      {/* Reconnecting banner */}
      {interviewState === "reconnecting" && (
        connectionLostLong ? (
          <div className="mt-2 flex min-w-0 items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 sm:px-4">
            <span className="animate-pulse">●</span>
            <span className="min-w-0 leading-relaxed">Connection is taking too long to restore. Please wait, and contact the interviewer if this persists.</span>
          </div>
        ) : (
          <div className="mt-2 flex min-w-0 items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2.5 text-sm text-yellow-800 [&>span:last-child]:min-w-0 [&>span:last-child]:leading-relaxed sm:px-4">
            <span className="animate-pulse">●</span>
            <span>Briefly reconnecting — please wait a moment.</span>
          </div>
        )
      )}

      {/* Reconnected prompt */}
      {reconnectedPrompt && (
        <div className="mt-2 flex min-w-0 items-start justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800 [&>span:first-child]:min-w-0 [&>span:first-child]:leading-relaxed sm:px-4">
          <span>Reconnected — please say <strong>"check"</strong> or continue your answer to resume.</span>
          <button className="ml-3 text-blue-500 hover:text-blue-700 shrink-0" onClick={() => setReconnectedPrompt(false)}>✕</button>
        </div>
      )}

      {/* Voice indicator */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-hidden py-4 sm:gap-6 sm:py-8">
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
              <div className="flex flex-col items-center gap-3">
                <VoiceBars
                  active={!awaitingAiResponse}
                  label={awaitingAiResponse ? "Waiting for AI..." : "You're speaking"}
                  variant="candidate"
                />
                <Button
                  size="sm"
                  onClick={finishAnswer}
                  disabled={!canFinishAnswer}
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                  Done answering
                </Button>
              </div>
            )}

            {/* Transcript */}
            {transcript.length > 0 && (
              <div className="max-h-[34dvh] w-full space-y-2 overflow-y-auto px-0.5 sm:max-h-72">
                {transcript.map((turn, i) => (
                  <TranscriptBubble key={i} speaker={turn.speaker} text={turn.text} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-0 flex shrink-0 flex-col gap-3 border-t bg-white py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex w-full min-w-0 items-center justify-between gap-3 sm:w-auto">
          <ConnectionStatus state={wsConnectionStatus} />

          <div className="flex items-center gap-2 text-xs text-muted-foreground sm:hidden">
            <Mic className="h-3.5 w-3.5" />
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-secondary transition-[width]"
                style={{ width: `${micMuted ? 0 : visibleMicLevel}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:gap-3">
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex sm:min-w-24 sm:shrink-0">
            <Mic className="h-3.5 w-3.5" />
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-secondary transition-[width]"
                style={{ width: `${micMuted ? 0 : visibleMicLevel}%` }}
              />
            </div>
          </div>

          <Button
            variant={micMuted ? "destructive" : "outline"}
            size="sm"
            className="w-full min-w-0 px-2 sm:w-auto sm:px-3"
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
            <Button variant="outline" size="sm" className="w-full min-w-0 px-2 sm:w-auto sm:px-3">
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
              <AlertDialogAction onClick={endInterview}>End interview</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {import.meta.env.DEV && (
          <Button variant="outline" size="sm" className="col-span-2 w-full min-w-0 px-2 text-xs opacity-50 sm:w-auto sm:shrink-0 sm:px-3"
            onClick={() => sendJson({ type: "debug_force_reconnect" })}>
            ⚡ Force reconnect
          </Button>
        )}
        </div>
      </div>

    </div>
  );
}
