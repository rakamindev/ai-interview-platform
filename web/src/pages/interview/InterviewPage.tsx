import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import VoiceBars from "@/components/interview/VoiceBars";
import InterviewTimer from "@/components/interview/InterviewTimer";
import ConnectionStatus from "@/components/interview/ConnectionStatus";
import TranscriptBubble from "@/components/interview/TranscriptBubble";
import InterviewCompleteScreen from "@/components/interview/InterviewCompleteScreen";
import ExitConfirmDialog, { type ExitPromptSource } from "@/components/interview/ExitConfirmDialog";
import StatusBanner from "@/components/interview/StatusBanner";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useAudioWebSocket } from "@/hooks/useAudioWebSocket";
import { useExitGuard } from "@/hooks/useExitGuard";
import { sessionsApi } from "@/services/sessions";
import HardwareCheck from "@/components/HardwareCheck";
import { CheckCircle, Loader2, Mic, MicOff } from "lucide-react";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";

/**
 * States where the candidate still has something to lose by navigating away.
 * `draining_audio` is included on purpose: it can last up to 10s while the AI
 * finishes speaking, and leaving during it skips the audio_complete call.
 */
const IN_PROGRESS_STATES: InterviewState[] = [
  "connecting",
  "active",
  "reconnecting",
  "draining_audio",
];

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
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

  // Why the session ended, as reported by the backend. Left undefined until we
  // actually know — InterviewCompleteScreen reads "unknown" as a failure, never
  // as success (Step 3, Candidate P0).
  const [endReason, setEndReason] = useState<string | undefined>(undefined);
  const [endMessage, setEndMessage] = useState<string | undefined>(undefined);

  // Which flow opened the exit dialog: the back button, or the End Interview button.
  const [exitPrompt, setExitPrompt] = useState<ExitPromptSource | null>(null);

  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch candidate info
  useEffect(() => {
    if (!token) return;
    sessionsApi.getCandidateInfo(token)
      .then((res) => {
        setCandidateInfo(res.data);
        setSessionId(res.data.session_id);
        if (res.data.session_status === "ended") {
          // A candidate reopening the link is told how their session actually ended.
          setEndReason(res.data.end_reason ?? "error");
          setInterviewState("complete");
        }
      })
      .catch(() => {
        setEndReason("invalid_link");
        setEndMessage("This interview link is invalid or has already expired. Please contact your interviewer for a new one.");
        setInterviewState("complete");
      });
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

  // The backend's end_reason is the source of truth. A locally chosen reason (set in
  // endInterview) is only a fallback for the case where we end the session ourselves.
  const handleSessionEnd = useCallback((reason?: string, message?: string) => {
    setEndReason(reason ?? "error");
    if (message) setEndMessage(message);
  }, []);

  const handleReconnected = useCallback(() => {
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    setReconnectedPrompt(true);
    reconnectedPromptTimerRef.current = setTimeout(() => setReconnectedPrompt(false), 10_000);
  }, []);

  const handleTranscript = useCallback((turn: Pick<TranscriptTurn, "speaker" | "text">) => {
    setTranscript((prev) => [...prev.slice(-9), turn]); // keep last 10
  }, []);

  // Keep the newest turn in view. Without this, new turns render below the fold in a
  // fixed-height scroll container and the candidate misses the AI's latest question.
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
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
    onSessionEnd: handleSessionEnd,
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

  const endInterview = useCallback(async (reason: string = "manual_candidate") => {
    setExitPrompt(null);
    setEndReason((current) => current ?? reason);
    setInterviewState("ending");
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    stopCapture();
    stopPlayback();
    sendJson({ type: "end_session" });
    disconnect();
    setInterviewState("complete");
  }, [stopCapture, stopPlayback, sendJson, disconnect]);

  const interviewInProgress = IN_PROGRESS_STATES.includes(interviewState);

  const handleAttemptExit = useCallback(() => {
    setExitPrompt((current) => current ?? "navigation");
  }, []);

  useExitGuard({ enabled: interviewInProgress, onAttemptExit: handleAttemptExit });

  const wsConnectionStatus =
    interviewState === "reconnecting"
      ? connectionLostLong ? "lost" : "reconnecting"
      : connectionState === "connected"
      ? "connected"
      : "reconnecting";

  // ── State A: Pre-start ──────────────────────────────────────────────────
  if (interviewState === "idle") {
    return (
      <div className="mx-auto w-full max-w-xl space-y-6 px-4 py-8 sm:py-12">
        <header className="space-y-1.5 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            AI Interview
          </p>
          <h1 className="text-2xl font-semibold tracking-tight break-words">
            {candidateInfo?.role_title ?? "AI Interview"}
          </h1>
          {candidateInfo && (
            <p className="text-sm text-muted-foreground">
              Up to {candidateInfo.time_limit_min} minutes · one attempt
            </p>
          )}
        </header>

        {!hardwareCheckDone ? (
          <div className="space-y-5">
            <ul className="space-y-2.5 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
              <li className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                <span>This is a voice interview — find a quiet place before you start.</span>
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                <span>The AI asks follow-up questions. There is no script to memorise.</span>
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                <span>Your mic stays on. You can mute or end the session at any point.</span>
              </li>
              <li className="flex gap-2.5 font-medium text-foreground">
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-warning" />
                <span>You get one attempt. Once you leave or end it, it cannot be resumed.</span>
              </li>
            </ul>
            <HardwareCheck onStart={() => { setHardwareCheckDone(true); startInterview(); }} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-success-border bg-success-subtle px-4 py-2.5 text-sm">
              <CheckCircle className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              <span>Hardware checks passed. You're ready to start.</span>
            </div>
            <Button className="w-full" size="lg" onClick={startInterview}>
              <Mic className="mr-2 h-4 w-4" />
              Start Interview
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── State F: Complete ───────────────────────────────────────────────────
  if (interviewState === "complete") {
    return <InterviewCompleteScreen endReason={endReason} message={endMessage} />;
  }

  // ── States B/C/D/E: Active interview ────────────────────────────────────
  const aiSpeaking = speaker === "ai";
  const candidateSpeaking = speaker === "candidate";

  return (
    <div className="mx-auto flex h-full w-full max-w-xl flex-col px-4">
      {/* Header: who is being interviewed, and how long is left */}
      <header className="sticky top-12 z-10 flex items-center justify-between gap-3 border-b bg-background py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {candidateInfo?.role_title ?? "AI Interview"}
          </p>
          <p className="text-xs text-muted-foreground">Interview in progress</p>
        </div>
        {candidateInfo && (
          <InterviewTimer
            totalSeconds={candidateInfo.time_limit_min * 60}
            running={interviewState === "active"}
            onExpired={() => endInterview("time_ceiling")}
          />
        )}
      </header>

      {interviewState === "reconnecting" && (
        connectionLostLong ? (
          <StatusBanner tone="danger">
            <strong className="font-medium">Still trying to reconnect.</strong>{" "}
            Please stay on this page. If it doesn't recover shortly, contact your interviewer.
          </StatusBanner>
        ) : (
          <StatusBanner tone="warning">
            Briefly reconnecting — hold on a moment, your session is still running.
          </StatusBanner>
        )
      )}

      {reconnectedPrompt && (
        <StatusBanner tone="info" onDismiss={() => setReconnectedPrompt(false)}>
          Reconnected. Say <strong className="font-medium">"check"</strong> or just carry on
          with your answer to resume.
        </StatusBanner>
      )}

      {/* Stage */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8">
        {interviewState === "connecting" ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary motion-safe-only" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Connecting you to the interviewer</p>
              <p className="mt-0.5 text-xs text-muted-foreground">This usually takes a few seconds.</p>
            </div>
          </div>
        ) : interviewState === "draining_audio" ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <VoiceBars active={true} label="Interviewer speaking" variant="ai" />
            <p className="text-xs text-muted-foreground">Wrapping up — please don't close this page.</p>
          </div>
        ) : (
          <>
            <VoiceBars
              active={aiSpeaking}
              label={aiSpeaking ? "Interviewer speaking" : micMuted ? "Mic is muted" : "Listening to you"}
              variant="ai"
            />

            {candidateSpeaking && !micMuted && (
              <VoiceBars active={true} label="You're speaking" variant="candidate" />
            )}

            {transcript.length > 0 && (
              <div
                className="w-full space-y-2 overflow-y-auto max-h-[52vh] sm:max-h-[60vh]"
                data-testid="transcript-panel"
                aria-label="Live transcript"
              >
                {transcript.map((turn, i) => (
                  <TranscriptBubble key={i} speaker={turn.speaker} text={turn.text} />
                ))}
                <div ref={transcriptEndRef} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Action bar */}
      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-background pt-3 pb-safe">
        <ConnectionStatus state={wsConnectionStatus} />

        <div className="flex items-center gap-2">
          <Button
            variant={micMuted ? "destructive" : "outline"}
            size="sm"
            onClick={toggleMic}
            aria-pressed={micMuted}
          >
            {micMuted ? (
              <><MicOff className="mr-1.5 h-3.5 w-3.5" /> Muted</>
            ) : (
              <><Mic className="mr-1.5 h-3.5 w-3.5" /> Mic on</>
            )}
          </Button>

          <Button variant="outline" size="sm" onClick={() => setExitPrompt("manual")}>
            End
            <span className="ml-1 hidden sm:inline">interview</span>
          </Button>

          {import.meta.env.DEV && (
            <Button variant="outline" size="sm" className="text-xs opacity-50"
              onClick={() => sendJson({ type: "debug_force_reconnect" })}>
              ⚡
            </Button>
          )}
        </div>
      </div>

      <ExitConfirmDialog
        open={exitPrompt !== null}
        source={exitPrompt ?? "manual"}
        onContinue={() => setExitPrompt(null)}
        onEnd={() => endInterview("manual_candidate")}
      />
    </div>
  );
}
