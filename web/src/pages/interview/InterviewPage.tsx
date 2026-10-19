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
import HardwareCheck from "@/components/HardwareCheck";
import { CheckCircle, Mic, MicOff, RefreshCw } from "lucide-react";
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
        "flex min-h-44 flex-col rounded-xl border p-5 transition-colors sm:min-h-52 sm:p-6",
        active ? activeStyle : "border-border bg-white"
      )}
    >
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="flex flex-1 items-center justify-center py-5">
        <div className={cn("flex h-28 w-28 items-center justify-center rounded-full", voiceStyle)}>
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-border/70 bg-white">
            <VoiceBars active={active} label={label} variant={variant} />
          </div>
        </div>
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
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false); // kept for green banner
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const reconnectedPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      if (res.data.session_status === "ended") setInterviewState("complete");
    } catch {
      setCandidateInfoError(true);
    } finally {
      setCandidateInfoLoading(false);
    }
  }, [token]);

  useEffect(() => { loadCandidateInfo(); }, [loadCandidateInfo]);

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

  const { connect, send, sendJson, disconnect, connectionState } = useAudioWebSocket({
    sessionId: sessionId ?? 0,
    token,
    onAudioChunk: playChunk,
    onTranscript: handleTranscript,
    onStateChange: handleStateChange,
    onSpeakerChange: handleSpeakerChange,
    onReconnected: handleReconnected,
  });

  const { start: startCapture, stop: stopCapture, mute, unmute } = useAudioCapture({
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
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    stopCapture();
    stopPlayback();
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
      <div className="mx-auto w-full max-w-xl space-y-6 px-4 py-8 sm:py-12">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{candidateInfo?.role_title ?? "AI Interview"}</h1>
          {candidateInfo && (
            <p className="text-sm text-muted-foreground">
              Interview time: {candidateInfo.time_limit_min} minutes
            </p>
          )}
        </div>

        {!hardwareCheckDone ? (
          <div className="space-y-4">
            <div className="rounded-xl border bg-white p-5 text-sm sm:p-6">
              <h2 className="font-semibold">Before you begin</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
                <li>Find a quiet place for this voice interview.</li>
                <li>The interviewer may ask follow-up questions.</li>
                <li>Your microphone will be used during the interview. You can end at any time.</li>
              </ul>
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
  if (interviewState === "complete") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-12">
        <div className="w-full space-y-4 rounded-xl border bg-white p-6 text-center sm:p-8">
          <CheckCircle className="mx-auto h-9 w-9 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-semibold">Interview complete</h2>
          <p className="text-sm text-muted-foreground">
          Thank you. The interview has been recorded.
          <br />
          The hiring team will review your results and follow up with you.
          </p>
        </div>
      </div>
    );
  }

  // ── States B/C/D/E: Active interview ────────────────────────────────────
  const aiSpeaking = speaker === "ai";
  const candidateSpeaking = speaker === "candidate";
  const reconnecting = interviewState === "reconnecting";
  const aiStageActive = !reconnecting && (aiSpeaking || interviewState === "draining_audio");
  const candidateStageActive = !reconnecting && candidateSpeaking;

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col px-4">
      {/* Top bar */}
      <div className="sticky top-14 z-10 flex items-center justify-between border-b bg-white py-3">
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

      {/* Speaker stage and transcript */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 py-5">
        {interviewState === "connecting" && (
          <p role="status" className="text-center text-sm text-muted-foreground">Connecting to your interview…</p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5">
          <SpeakerStage
            title="AI interviewer"
            active={aiStageActive}
            label={reconnecting ? "Reconnecting" : interviewState === "draining_audio" ? "Wrapping up" : aiSpeaking ? "AI speaking" : "Waiting"}
            variant="ai"
          />
          <SpeakerStage
            title="You"
            active={candidateStageActive}
            label={reconnecting ? "Reconnecting" : candidateSpeaking ? "Your turn to speak" : aiSpeaking ? "Listening" : "Ready when you are"}
            variant="candidate"
          />
        </div>

        {transcript.length > 0 && (
          <section aria-label="Interview transcript" className="min-h-0 space-y-3">
            <h2 className="text-sm font-semibold">Conversation</h2>
            <div className="max-h-[38vh] space-y-2 overflow-y-auto pr-1 lg:max-h-[420px]">
              {transcript.map((turn, i) => (
                <TranscriptBubble key={i} speaker={turn.speaker} text={turn.text} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-0 flex flex-col gap-3 border-t bg-white py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <ConnectionStatus state={wsConnectionStatus} />

        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end sm:gap-3">
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
            <><RefreshCw className="h-3.5 w-3.5 mr-1" />Force reconnect</>
          </Button>
        )}
        </div>
      </div>

    </div>
  );
}
