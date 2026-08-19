import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { CheckCircle, Mic, MicOff, ShieldAlert, LayoutDashboard } from "lucide-react";
import type { CandidateInfo, InterviewState, InterviewSpeaker, TranscriptTurn } from "@/types";

export default function InterviewPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [speaker, setSpeaker] = useState<InterviewSpeaker>(null);
  const [transcript, setTranscript] = useState<Pick<TranscriptTurn, "speaker" | "text">[]>([]);
  const [hardwareCheckDone, setHardwareCheckDone] = useState(false); // kept for green banner
  const [connectionLostLong, setConnectionLostLong] = useState(false);
  const [reconnectedPrompt, setReconnectedPrompt] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const reconnectedPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionLostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const micMutedRef = useRef(false);

  // Fetch candidate info
  useEffect(() => {
    if (!token) return;
    sessionsApi.getCandidateInfo(token)
      .then((res) => {
        setCandidateInfo(res.data);
        setSessionId(res.data.session_id);
        if (res.data.session_status === "ended") {
          setInterviewState("complete");
        } else if (res.data.session_status === "active") {
          // If candidate refreshed during active session, mark hardware check done
          setHardwareCheckDone(true);
        }
      })
      .catch((err) => {
        if (err.response?.status === 403) {
          setAccessError(
            err.response?.data?.errors?.[0]?.message ||
              "Access Denied: This interview session is intended for another registered candidate email."
          );
        } else {
          setInterviewState("complete");
        }
      });
  }, [token]);

  // Prevent accidental refresh or tab close during active interview
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (
        interviewState === "active" ||
        interviewState === "connecting" ||
        interviewState === "reconnecting" ||
        interviewState === "draining_audio"
      ) {
        e.preventDefault();
        e.returnValue =
          "An active interview is in progress. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [interviewState]);

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

  if (accessError) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 sm:py-16 text-center space-y-4">
        <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-5 sm:p-6 space-y-3">
          <ShieldAlert className="h-10 w-10 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold text-foreground">Access Denied</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">{accessError}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/assessments")}>
          Back to Assessments
        </Button>
      </div>
    );
  }

  // ── State A: Pre-start ──────────────────────────────────────────────────
  if (interviewState === "idle") {
    return (
      <div className="max-w-xl mx-auto px-4 py-6 sm:py-10 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">{candidateInfo?.role_title ?? "AI Interview"}</h1>
          {candidateInfo && (
            <p className="text-xs sm:text-sm text-muted-foreground">
              Estimated duration: {candidateInfo.time_limit_min} minutes
            </p>
          )}
        </div>

        {candidateInfo?.session_status === "active" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>You have an ongoing interview session in progress.</span>
            </div>
            <Button
              className="w-full h-11 sm:h-10 text-sm sm:text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              size="lg"
              onClick={startInterview}
            >
              <Mic className="h-4.5 w-4.5 mr-2" />
              Resume Active Interview
            </Button>
          </div>
        ) : !hardwareCheckDone ? (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-xl p-4 text-xs sm:text-sm space-y-2 text-muted-foreground border">
              <p>• This is a voice interview. Make sure you're in a quiet place.</p>
              <p>• The AI will ask follow-up questions — there are no scripts.</p>
              <p>• The session will last up to {candidateInfo?.time_limit_min ?? "—"} minutes.</p>
              <p>• Your mic will be active throughout. You can end anytime.</p>
            </div>
            <HardwareCheck onStart={() => { setHardwareCheckDone(true); startInterview(); }} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
              <span>Hardware checks passed. You're ready to start.</span>
            </div>
            <Button className="w-full h-11 sm:h-10 text-sm sm:text-base font-semibold shadow-xs" size="lg" onClick={startInterview}>
              <Mic className="h-4.5 w-4.5 mr-2" />
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
      <div className="max-w-xl mx-auto px-4 py-12 sm:py-16 text-center space-y-5">
        <div className="text-4xl sm:text-5xl">✅</div>
        <div className="space-y-1.5">
          <h2 className="text-lg sm:text-xl font-bold text-foreground">Interview Complete</h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Thank you. The interview has been recorded.
            <br />
            The hiring team will review your results and follow up with you.
          </p>
        </div>
        <div className="pt-3">
          <Button onClick={() => navigate("/assessments")} className="text-xs font-semibold px-5 h-10 shadow-xs">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // ── States B/C/D/E: Active interview ────────────────────────────────────
  const aiSpeaking = speaker === "ai";
  const candidateSpeaking = speaker === "candidate";

  return (
    <div className="max-w-xl mx-auto px-3 sm:px-4 flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between py-2.5 px-3 sm:px-4 border-b sticky top-0 bg-white z-10 text-xs sm:text-sm font-medium">
        <span className="font-semibold text-foreground truncate max-w-[180px] sm:max-w-xs">
          {candidateInfo?.role_title ?? "AI Interview"}
        </span>
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
          <div className="flex items-center gap-2 text-xs sm:text-sm bg-red-50 border border-red-200 text-red-800 rounded-lg px-3.5 py-2 mt-2 shrink-0">
            <span className="animate-pulse text-red-600">●</span>
            <span>Connection taking long to restore. Please wait or contact interviewer.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs sm:text-sm bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-3.5 py-2 mt-2 shrink-0">
            <span className="animate-pulse text-yellow-600">●</span>
            <span>Reconnecting — please wait a moment.</span>
          </div>
        )
      )}

      {/* Reconnected prompt */}
      {reconnectedPrompt && (
        <div className="flex items-center justify-between text-xs sm:text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3.5 py-2 mt-2 shrink-0">
          <span>Reconnected — say <strong>"check"</strong> or continue your answer to resume.</span>
          <button className="ml-2 text-blue-500 hover:text-blue-700 shrink-0 p-1" onClick={() => setReconnectedPrompt(false)}>✕</button>
        </div>
      )}

      {/* Voice indicator & transcript container */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 sm:gap-6 py-4 sm:py-8 min-h-0 overflow-hidden">
        {interviewState === "connecting" ? (
          <div className="text-sm text-muted-foreground animate-pulse font-medium">Connecting audio stream...</div>
        ) : interviewState === "draining_audio" ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <VoiceBars active={true} label="AI speaking" variant="ai" />
            <p className="text-xs text-muted-foreground">Wrapping up...</p>
          </div>
        ) : (
          <>
            <div className="shrink-0 flex flex-col items-center gap-3">
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

            {/* Transcript scroll area */}
            {transcript.length > 0 && (
              <div className="w-full space-y-2 overflow-y-auto max-h-[40vh] sm:max-h-[50vh] pr-1 mt-2">
                {transcript.map((turn, i) => (
                  <TranscriptBubble key={i} speaker={turn.speaker} text={turn.text} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom control bar */}
      <div className="border-t py-3 px-3 sm:px-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-4 sticky bottom-0 bg-white z-10 shadow-xs">
        <div className="flex items-center justify-between sm:justify-start">
          <ConnectionStatus state={wsConnectionStatus} />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button
            variant={micMuted ? "destructive" : "outline"}
            size="sm"
            className="flex-1 sm:flex-none h-9 sm:h-8 text-xs font-medium"
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
              <Button variant="outline" size="sm" className="flex-1 sm:flex-none h-9 sm:h-8 text-xs font-medium">
                End Interview
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-xl sm:rounded-2xl p-4 sm:p-6">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-base sm:text-lg">End interview?</AlertDialogTitle>
                <AlertDialogDescription className="text-xs sm:text-sm">
                  Are you sure you want to end the interview early?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-3">
                <AlertDialogCancel className="w-full sm:w-auto text-xs mt-0">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={endInterview} className="w-full sm:w-auto text-xs font-semibold">
                  End interview
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {import.meta.env.DEV && (
            <Button
              variant="outline"
              size="sm"
              className="text-[11px] h-9 sm:h-8 opacity-60"
              onClick={() => sendJson({ type: "debug_force_reconnect" })}
            >
              ⚡ Force
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
