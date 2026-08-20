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
import { AlertTriangle, CheckCircle, Mic, MicOff } from "lucide-react";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<Pick<TranscriptTurn, "speaker" | "text">[]>([]);
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false); // kept for green banner
  const [pdpConsent, setPdpConsent] = useState(false);
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const reconnectedPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);
  const [sessionEndReason, setSessionEndReason] = useState<string | null>(null);
  const [sessionErrorMessage, setSessionErrorMessage] = useState<string | null>(null);

  const handleSessionEnded = useCallback((payload: { reason?: string; message?: string }) => {
    if (payload.reason) setSessionEndReason(payload.reason);
    if (payload.message) setSessionErrorMessage(payload.message);
  }, []);

  // Fetch candidate info
  useEffect(() => {
    if (!token) return;
    sessionsApi.getCandidateInfo(token)
      .then((res) => {
        const info = (res.data as any)?.session_id ? res.data : ((res.data as any)?.data ?? res.data);
        if (info && info.session_id) {
          setCandidateInfo(info);
          setSessionId(info.session_id);
          if (info.session_status === "ended") setInterviewState("complete");
        }
      })
      .catch((err) => console.error("Error fetching candidate info:", err));
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
    if (reconnectedPromptTimerRef.current) clearTimeout(reconnectedPromptTimerRef.current);
    setReconnectedPrompt(true);
    reconnectedPromptTimerRef.current = setTimeout(() => setReconnectedPrompt(false), 10_000);
  }, []);

  const handleTranscript = useCallback((turn: Pick<TranscriptTurn, "speaker" | "text">) => {
    setTranscript((prev) => [...prev.slice(-9), turn]); // keep last 10
  }, []);

  const { playChunk, stop: stopPlayback, scheduleAfterPlayback, waitForDrain, cancelDrain, ensureResumed } = useAudioPlayback();

  useEffect(() => {
    const handleGesture = () => ensureResumed();
    window.addEventListener("pointerdown", handleGesture);
    window.addEventListener("keydown", handleGesture);
    return () => {
      window.removeEventListener("pointerdown", handleGesture);
      window.removeEventListener("keydown", handleGesture);
    };
  }, [ensureResumed]);
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
    onSessionEnded: handleSessionEnded,
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

        <div className="border rounded-lg p-4 space-y-2 bg-blue-50/50 border-blue-200 text-xs text-muted-foreground">
          <p className="font-semibold text-blue-900">Privacy Notice &amp; Consent (UU PDP)</p>
          <p>
            By proceeding, you consent to voice recording and data processing for skills assessment in compliance with Indonesia's Personal Data Protection Law (UU PDP).
          </p>
          <label className="flex items-center gap-2 pt-1 font-medium text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={pdpConsent}
              onChange={(e) => setPdpConsent(e.target.checked)}
              className="rounded border-muted-foreground"
            />
            I consent to voice recording and data processing
          </label>
        </div>

        {!hardwareCheckDone ? (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1.5 text-muted-foreground">
              <p>• This is a voice interview. Make sure you're in a quiet place.</p>
              <p>• The AI will ask follow-up questions — there are no scripts.</p>
              <p>• The session will last up to {candidateInfo?.time_limit_min ?? "—"} minutes.</p>
              <p>• Your mic will be active throughout. You can end anytime.</p>
            </div>
            {pdpConsent ? (
              <HardwareCheck onStart={() => { setHardwareCheckDone(true); startInterview(); }} />
            ) : (
              <p className="text-xs text-amber-600 font-medium">Please accept the privacy consent above to begin hardware check.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>Hardware checks passed. You're ready to start.</span>
            </div>
            <Button id="main-start-interview-btn" className="w-full" size="lg" onClick={startInterview} disabled={!pdpConsent || !sessionId}>
              <Mic className="h-4 w-4 mr-2" />
              Start Interview
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── State F: Complete / Error ───────────────────────────────────────────────────
  if (interviewState === "complete" || interviewState === "error") {
    const isError = interviewState === "error" || sessionEndReason === "error" || Boolean(sessionErrorMessage);
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        {isError ? (
          <>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600 mx-auto">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold">Server Error</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {sessionErrorMessage || "The server is currently experiencing trouble, please try again later."}
            </p>
          </>
        ) : (
          <>
            <div className="text-4xl">✅</div>
            <h2 className="text-xl font-semibold">Interview Complete</h2>
            <p className="text-sm text-muted-foreground">
              Thank you. The interview has been recorded.
              <br />
              The hiring team will review your results and follow up with you.
            </p>
          </>
        )}
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

      {/* Voice indicator */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
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
              <VoiceBars
                active={true}
                label="You're speaking"
                variant="candidate"
              />
            )}

            {/* Transcript */}
            {transcript.length > 0 && (
              <div className="w-full space-y-2 overflow-y-auto max-h-[60vh]">
                {transcript.map((turn, i) => (
                  <TranscriptBubble key={i} speaker={turn.speaker} text={turn.text} />
                ))}
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
            ⚡ Force reconnect
          </Button>
        )}
        </div>
      </div>

    </div>
  );
}
