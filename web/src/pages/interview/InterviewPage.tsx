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
import { CheckCircle, Loader2, Mic, MicOff } from "lucide-react";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [infoError, setInfoError] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentError, setConsentError] = useState(false);
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
  const [fatalError, setFatalError] = useState<string | null>(null);
  // True only once the AI audio queue has actually drained after preparing_to_end,
  // so "Wrapping up..." never appears while the AI is still talking.
  const [wrapUpShown, setWrapUpShown] = useState(false);
  // Load-time state: the session was already ended with end_reason=error (candidate
  // abandoned it and the grace period expired). Unlike a runtime error there is nothing
  // to retry — show a terminal message instead of the retry screen.
  const [sessionEndedWithError, setSessionEndedWithError] = useState(false);

  // Fetch candidate info
  const loadCandidateInfo = useCallback(async () => {
    if (!token) return;
    setInfoError(false);
    setCandidateInfo(null);
    try {
      const res = await sessionsApi.getCandidateInfo(token);
      setCandidateInfo(res.data);
      setSessionId(res.data.session_id);
      setConsentGiven(res.data.consent_recorded ?? false);
      if (res.data.session_status === "ended") {
        // Ended because of a server error — never show the fake "Interview Complete".
        // This is terminal (grace period expired, session can't be resumed).
        if (res.data.end_reason === "error") {
          setSessionEndedWithError(true);
        } else {
          setInterviewState("complete");
        }
      }
    } catch {
      // A network failure is NOT a successful interview — show a retry screen.
      setInfoError(true);
    }
  }, [token]);

  useEffect(() => {
    loadCandidateInfo();
  }, [loadCandidateInfo]);

  const handleConsent = useCallback(async () => {
    if (!token) return;
    setConsentLoading(true);
    setConsentError(false);
    try {
      await sessionsApi.recordConsent(token);
      setConsentGiven(true);
    } catch {
      setConsentError(true);
    } finally {
      setConsentLoading(false);
    }
  }, [token]);

  const muteRef = useRef<(() => void) | null>(null);
  const unmuteRef = useRef<(() => void) | null>(null);

  const handleStateChange = useCallback((state: InterviewState) => {
    setInterviewState(state);

    if (state === "draining_audio") {
      // Mute mic, stop sending — wait for audio queue to drain then call audio_complete
      setWrapUpShown(false);
      muteRef.current?.();
      audioCompleteCalledRef.current = false;
      // Safety timeout: call audio_complete after 10s even if drain never fires
      audioCompleteSafetyTimerRef.current = setTimeout(() => {
        setWrapUpShown(true);
        callAudioComplete();
      }, 10_000);
      // Only show "Wrapping up..." once the AI has actually finished speaking
      waitForDrain(() => {
        setWrapUpShown(true);
        callAudioComplete();
      });
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
    // Server-side error → show the error screen, do not end the interview.
    onError: (message) => setFatalError(message),
  });

  const { start: startCapture, stop: stopCapture, mute, unmute } = useAudioCapture({
    onFrame: send,
  });

  muteRef.current = mute;
  unmuteRef.current = unmute;

  // Release the mic/audio when a fatal server error leaves the ws closed.
  useEffect(() => {
    if (fatalError) {
      stopCapture();
      stopPlayback();
    }
  }, [fatalError, stopCapture, stopPlayback]);

  // Interview finished (server-side wrap-up or page reload after end) —
  // release the mic so the browser stops recording.
  useEffect(() => {
    if (interviewState === "complete") {
      stopCapture();
      stopPlayback();
    }
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

  // Server-side error → reconnect in place. The backend keeps the session active on
  // its failures (server_cut), so a fresh connection resumes from the last discussion
  // via the resumption token — no full page reload, no re-consent, no re-check.
  const retryAfterError = useCallback(() => {
    setFatalError(null);
    setSpeaker(null);
    startInterview();
  }, [startInterview]);

  const wsConnectionStatus =
    interviewState === "reconnecting"
      ? connectionLostLong ? "lost" : "reconnecting"
      : connectionState === "connected"
      ? "connected"
      : "reconnecting";

  // Server-side error — the interview did NOT end. Show an error, not the complete screen.
  if (sessionEndedWithError) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-xl font-semibold">Interview could not be completed</h2>
        <p className="text-sm text-muted-foreground">
          There was a problem on our side and this session could not be finished.
          Please contact the interviewer — they can start a new interview for you.
        </p>
      </div>
    );
  }

  if (fatalError) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">{fatalError}</p>
        <p className="text-xs text-muted-foreground">
          There&apos;s a problem on our side. Your interview is not over — when you retry,
          you&apos;ll continue from where you left off. Your answers so far are saved.
        </p>
        <Button size="lg" onClick={retryAfterError}>
          Try again
        </Button>
      </div>
    );
  }

  // ── State A: Pre-start ──────────────────────────────────────────────────
  if (interviewState === "idle") {
    // Candidate info failed to load — this is NOT a completed interview.
    if (infoError) {
      return (
        <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
          <div className="text-4xl">😕</div>
          <h2 className="text-xl font-semibold">Could not load your interview</h2>
          <p className="text-sm text-muted-foreground">
            We couldn't reach the interview service. Check your connection and try again.
          </p>
          <Button size="lg" onClick={loadCandidateInfo}>
            Retry
          </Button>
        </div>
      );
    }

    // UU PDP: consent is recorded before any audio capture can start.
    if (candidateInfo?.requires_consent && !consentGiven) {
      return (
        <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-xl font-semibold">{candidateInfo.role_title}</h1>
            <p className="text-sm text-muted-foreground">{candidateInfo.time_limit_min} minutes</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-5 space-y-3 text-sm">
            <p className="font-medium">Before we begin, please review how your data is used:</p>
            <ul className="space-y-1.5 text-muted-foreground list-disc pl-5">
              <li>This interview is recorded and transcribed (audio + text).</li>
              <li>Your responses are analyzed to assess your skills for this role.</li>
              <li>The recording and transcript are shared only with the hiring team for this position.</li>
              <li>Data is kept only as long as needed for the hiring decision and deleted on request.</li>
            </ul>
            <p className="text-muted-foreground">
              By continuing you consent to this processing in accordance with applicable data protection law (UU PDP).
            </p>
          </div>
          {consentError && (
            <p className="text-sm text-destructive">
              Could not record your consent. Please try again.
            </p>
          )}
          <Button className="w-full" size="lg" onClick={handleConsent} disabled={consentLoading}>
            {consentLoading ? "Saving..." : "I consent — continue"}
          </Button>
        </div>
      );
    }

    // Never run browser/hardware checks until the session info has loaded.
    // The HardwareCheck component fires camera/mic/speed checks on mount; if it
    // rendered while candidateInfo is still null it would probe the browser
    // before the candidate has given (or even seen the) consent.
    if (!candidateInfo) {
      return (
        <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading your interview...</p>
        </div>
      );
    }

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
        ) : interviewState === "draining_audio" && wrapUpShown ? (
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
