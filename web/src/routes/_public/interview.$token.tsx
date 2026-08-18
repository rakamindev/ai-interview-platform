import { useEffect, useRef, useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle, Mic, MicOff, Zap } from "lucide-react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

import { TranscriptBubble } from "@/features/session/components/transcript-bubble";
import { VoiceBars } from "@/features/session/components/voice-bars";
import { InterviewTimer } from "@/features/session/components/interview-timer";
import { ConnectionStatus } from "@/features/session/components/connection-status";
import { HardwareCheck } from "@/features/candidate/components/hardware-check";
import { candidateApi } from "@/features/candidate/api/candidate";
import { useAudioCapture } from "@/features/session/hooks/use-audio-capture";
import { useAudioPlayback } from "@/features/session/hooks/use-audio-playback";
import { useAudioWebSocket } from "@/features/session/hooks/use-audio-websocket";
import type { CandidateInfo, InterviewSpeaker, InterviewState } from "@/features/session/schemas/interview";

export const Route = createFileRoute("/_public/interview/$token")({
  component: RouteComponent,
});

interface TranscriptEntry {
  speaker: "candidate" | "assessor" | "system" | "ai";
  text: string;
}

function RouteComponent() {
  const { token } = Route.useParams();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false); // kept for green banner
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const reconnectedPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);

  // Fetch candidate info
  useEffect(() => {
    if (!token) return;
    candidateApi
      .getInfo(token)
      .then((res) => {
        setCandidateInfo(res);
        setSessionId(res.session_id);
        if (res.session_status === "ended") setInterviewState("complete");
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
      if (state === "active" && !micMutedRef.current) unmuteRef.current?.();
    }
  }, []);

  const handleReconnected = useCallback(() => {
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    setReconnectedPrompt(true);
    reconnectedPromptTimerRef.current = setTimeout(() => setReconnectedPrompt(false), 10_000);
  }, []);

  const handleTranscript = useCallback((turn: TranscriptEntry) => {
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
    const attempt = async (delay: number) => {
      try {
        await candidateApi.audioComplete(token);
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
    [scheduleAfterPlayback]
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

  // ── State A: Pre-start ──────────────────────────────────────────────────
  if (interviewState === "idle") {
    return (
      <div className="mx-auto w-full max-w-xl space-y-6 px-4 py-8">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">{candidateInfo?.role_title ?? "AI Interview"}</h1>
          {candidateInfo && <p className="text-sm text-muted-foreground">{candidateInfo.time_limit_min} minutes</p>}
        </div>

        {!hardwareCheckDone ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground typeset typeset-docs">
              <ul>
                <li>This is a voice interview. Make sure you're in a quiet place.</li>
                <li>The AI will ask follow-up questions — there are no scripts.</li>
                <li>The session will last up to {candidateInfo?.time_limit_min ?? "—"} minutes.</li>
                <li>Your mic will be active throughout. You can end anytime.</li>
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
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-success">
              <CheckCircle className="size-4 shrink-0" />
              <span>Hardware checks passed. You're ready to start.</span>
            </div>
            <Button className="w-full" size="lg" onClick={startInterview}>
              <Mic className="mr-2 size-4" />
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
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="size-12 bg-success/10 text-success">
            <CheckCircle className="size-5" />
          </EmptyMedia>
          <EmptyTitle className="text-xl">Interview Complete</EmptyTitle>
        </EmptyHeader>
        <EmptyDescription>
          Thank you. The interview has been recorded.
          <br />
          The hiring team will review your results and follow up with you.
        </EmptyDescription>
      </Empty>
    );
  }

  // ── States B/C/D/E: Active interview ────────────────────────────────────
  const aiSpeaking = speaker === "ai";
  const candidateSpeaking = speaker === "candidate";

  return (
    <div className="mx-auto flex h-full w-full max-w-xl flex-col px-4">
      {/* Top bar */}
      <div className="sticky top-12 z-10 flex items-center justify-between border-b bg-background py-3">
        <span className="text-sm font-medium">{candidateInfo?.role_title}</span>
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
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            <span className="animate-pulse">●</span>
            <span>Connection is taking too long to restore. Please wait, and contact the interviewer if this persists.</span>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-warning">
            <span className="animate-pulse">●</span>
            <span>Briefly reconnecting — please wait a moment.</span>
          </div>
        ))}

      {/* Reconnected prompt */}
      {reconnectedPrompt && (
        <div className="mt-2 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm text-primary">
          <span>
            Reconnected — please say <strong>"check"</strong> or continue your answer to resume.
          </span>
          <button className="ml-3 shrink-0 hover:opacity-70" onClick={() => setReconnectedPrompt(false)}>
            ✕
          </button>
        </div>
      )}

      {/* Voice indicator */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8">
        {interviewState === "connecting" ? (
          <div className="animate-pulse text-sm text-muted-foreground">Connecting...</div>
        ) : interviewState === "draining_audio" ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <VoiceBars active label="AI speaking" variant="ai" />
            <p className="text-xs text-muted-foreground">Wrapping up...</p>
          </div>
        ) : (
          <>
            <VoiceBars active={aiSpeaking} label={aiSpeaking ? "AI speaking" : "Listening..."} variant="ai" />

            {candidateSpeaking && <VoiceBars active label="You're speaking" variant="candidate" />}

            {/* Transcript */}
            {transcript.length > 0 && (
              <div className="max-h-[60vh] w-full space-y-2 overflow-y-auto">
                {transcript.map((turn, i) => (
                  <TranscriptBubble key={i} speaker={turn.speaker} text={turn.text} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t bg-background py-3">
        <ConnectionStatus state={wsConnectionStatus} />

        <div className="flex items-center gap-3">
          <Button variant={micMuted ? "destructive" : "outline"} size="sm" onClick={toggleMic}>
            {micMuted ? (
              <>
                <MicOff className="mr-1.5 size-3.5" /> Muted
              </>
            ) : (
              <>
                <Mic className="mr-1.5 size-3.5" /> Mic On
              </>
            )}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
              End Interview
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
              onClick={() => sendJson({ type: "debug_force_reconnect" })}
            >
              <Zap data-icon="inline-start" />
              Force reconnect
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
